import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { NearIntentsClient } from '../../integrations/near-intents.client';
import { OneInchClient } from '../../integrations/oneinch.client';
import { QuoteEvmDto } from './dto/quote-evm.dto';
import { BuildSwapTxDto } from './dto/build-swap-tx.dto';
import { ConfirmEvmTxDto } from './dto/confirm-evm-tx.dto';
import { INTENTS_TOKEN_IDS, getIntentsTokenInfo } from '../../config/intents-tokens.config';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nearIntentsClient: NearIntentsClient,
    private readonly oneInchClient: OneInchClient,
  ) {}

  async create(createPaymentIntentDto: CreatePaymentIntentDto) {
    return this.prisma.paymentIntent.create({
      data: {
        merchantId: createPaymentIntentDto.merchantId,
        amount: createPaymentIntentDto.amount,
        currency: createPaymentIntentDto.currency,
        payoutAsset: createPaymentIntentDto.payoutAsset,
        payoutChain: createPaymentIntentDto.payoutChain,
        mode: createPaymentIntentDto.mode,
        status: 'CREATED',
        provider: 'intents', // Default to intents for now
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.paymentIntent.findUnique({
      where: { id },
      include: {
        merchant: true,
      },
    });
  }

  async getStatus(id: string) {
    const paymentIntent = await this.findOne(id);
    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent with ID ${id} not found`);
    }

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      provider: paymentIntent.provider,
      payoutAsset: paymentIntent.payoutAsset,
      payoutChain: paymentIntent.payoutChain,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      oneInchStatus: paymentIntent.oneInchStatus,
      oneInchTxHash: paymentIntent.oneInchTxHash,
    };
  }

  async quoteZec(id: string) {
    const paymentIntent = await this.findOne(id);
    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent with ID ${id} not found`);
    }

    if (paymentIntent.status !== 'CREATED') {
      throw new BadRequestException(
        `Payment intent is in ${paymentIntent.status} status. Only CREATED intents can be quoted.`,
      );
    }

    // Determine token IDs and decimals
    const originAssetInfo = INTENTS_TOKEN_IDS.ZEC;
    let destinationAssetInfo: { id: string; decimals: number };
    
    try {
      // Get destination token info using helper
      destinationAssetInfo = getIntentsTokenInfo(
        paymentIntent.payoutAsset,
        paymentIntent.payoutChain
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to determine destination token ID: ${error.message}`,
      );
    }

    // Convert amount to smallest unit based on destination decimals (EXACT_OUTPUT)
    // We assume amount is a decimal string like "100.00"
    const amountDecimal = parseFloat(paymentIntent.amount);
    if (isNaN(amountDecimal)) {
      throw new BadRequestException(`Invalid amount format: ${paymentIntent.amount}`);
    }

    // Calculate atomic units: amount * 10^decimals
    // Using BigInt for precision would be better for production, but number/string works for now given JS constraints
    // Ideally use a library like 'bignumber.js' or 'ethers' for currency math
    const atomicAmount = Math.floor(amountDecimal * Math.pow(10, destinationAssetInfo.decimals)).toString();

    // Get quote with deposit address
    const quoteResponse = await this.nearIntentsClient.getQuoteWithDeposit({
      originAsset: originAssetInfo.id,
      destinationAsset: destinationAssetInfo.id,
      swapType: 'EXACT_OUTPUT', // Merchant must get exact amount
      amount: atomicAmount,
      destinationAddress: paymentIntent.merchant.payoutAddress,
      slippageTolerance: 50, // 0.5% slippage tolerance (50 bps)
    });

    if (!quoteResponse.depositAddress) {
      throw new BadRequestException('Failed to get deposit address from Intents API');
    }

    // Update payment intent with quote data
    const updatedIntent = await this.prisma.paymentIntent.update({
      where: { id },
      data: {
        intentsDepositAddress: quoteResponse.depositAddress,
        intentsOriginAssetId: originAssetInfo.id,
        intentsDestinationAssetId: destinationAssetInfo.id,
        intentsSwapType: 'EXACT_OUTPUT',
        intentsRawQuote: quoteResponse as any,
        intentsStatus: 'PENDING_DEPOSIT',
        provider: 'intents',
        status: 'AWAITING_DEPOSIT',
      },
      include: {
        merchant: true,
      },
    });

    return {
      depositAddress: quoteResponse.depositAddress,
      expectedAmountInZec: quoteResponse.depositAmount || quoteResponse.amount,
      payoutAsset: paymentIntent.payoutAsset,
      payoutChain: paymentIntent.payoutChain,
      paymentIntentId: updatedIntent.id,
      status: updatedIntent.status,
    };
  }

  async quoteEvm(id: string, dto: QuoteEvmDto) {
    const paymentIntent = await this.findOne(id);
    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent with ID ${id} not found`);
    }

    // We assume the payoutAsset in DB is the token address on the target chain.
    // And for this flow, we assume target chain == user chain (dto.chainId).
    // If not, this basic swap might fail or result in tokens on user chain, which is fine for MVP if merchant accepts it.
    
    // Convert amountDecimal to atomic units
    const amountDecimal = parseFloat(dto.amountDecimal);
    if (isNaN(amountDecimal)) {
      throw new BadRequestException(`Invalid amount format: ${dto.amountDecimal}`);
    }
    
    const atomicAmount = BigInt(Math.floor(amountDecimal * Math.pow(10, dto.fromTokenDecimals))).toString();

    const quote = await this.oneInchClient.getQuote({
      chainId: dto.chainId,
      fromTokenAddress: dto.fromTokenAddress,
      toTokenAddress: paymentIntent.payoutAsset,
      amount: atomicAmount,
    });

    // Store the input amount in the quote object so we can use it later for building tx
    const quoteWithInput = { ...quote, inputAmount: atomicAmount };

    await this.prisma.paymentIntent.update({
      where: { id },
      data: {
        provider: '1inch',
        oneInchChainId: dto.chainId,
        oneInchFromToken: dto.fromTokenAddress,
        oneInchToToken: paymentIntent.payoutAsset,
        oneInchQuote: quoteWithInput as any,
        status: 'AWAITING_DEPOSIT', // Waiting for user to send tx
      },
    });

    return {
      quote: quoteWithInput,
      expectedAmountOut: quote.dstAmount,
    };
  }

  async buildEvmSwapTx(id: string, dto: BuildSwapTxDto) {
    const paymentIntent = await this.findOne(id);
    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent with ID ${id} not found`);
    }

    const quote = paymentIntent.oneInchQuote as any;
    if (!quote || !quote.inputAmount) {
      throw new BadRequestException('No valid 1inch quote found for this payment intent');
    }

    const tx = await this.oneInchClient.buildSwapTx({
      chainId: dto.chainId,
      fromTokenAddress: dto.fromTokenAddress,
      toTokenAddress: paymentIntent.payoutAsset,
      amount: quote.inputAmount,
      fromAddress: dto.userAddress,
      slippage: dto.slippageBps / 100, // bps to percent (100 bps = 1%)


    });

    return tx;
  }

  async confirmEvmTx(id: string, dto: ConfirmEvmTxDto) {
    const paymentIntent = await this.findOne(id);
    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent with ID ${id} not found`);
    }

    await this.prisma.paymentIntent.update({
      where: { id },
      data: {
        oneInchTxHash: dto.txHash,
        status: 'COMPLETED', // Assume success for Day 4
        oneInchStatus: 'SUCCESS',
      },
    });

    return { success: true };
  }
}
