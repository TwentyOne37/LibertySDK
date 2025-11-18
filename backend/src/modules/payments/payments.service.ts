import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { NearIntentsClient } from '../../integrations/near-intents.client';
import { INTENTS_TOKEN_IDS } from '../../config/intents-tokens.config';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nearIntentsClient: NearIntentsClient,
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

    // Determine token IDs
    const originAssetId = INTENTS_TOKEN_IDS.ZEC;
    let destinationAssetId: string;
    
    try {
      // For now, assume payoutAsset is USDC and payoutChain is ethereum
      // In production, you'd map this more dynamically
      if (paymentIntent.payoutAsset.toUpperCase() === 'USDC' && 
          paymentIntent.payoutChain.toLowerCase().includes('ethereum')) {
        destinationAssetId = INTENTS_TOKEN_IDS.USDC_ETHEREUM;
      } else {
        throw new Error(`Unsupported payout asset/chain: ${paymentIntent.payoutAsset} on ${paymentIntent.payoutChain}`);
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to determine destination token ID: ${error.message}`,
      );
    }

    // Convert amount to smallest unit (assuming 18 decimals for ZEC, but should be configurable)
    // For now, we'll pass the amount as-is and let Intents API handle it
    const amountInSmallestUnit = paymentIntent.amount;

    // Get quote with deposit address
    const quoteResponse = await this.nearIntentsClient.getQuoteWithDeposit({
      originAsset: originAssetId,
      destinationAsset: destinationAssetId,
      swapType: 'EXACT_OUTPUT', // Merchant must get exact amount
      amount: amountInSmallestUnit,
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
        intentsOriginAssetId: originAssetId,
        intentsDestinationAssetId: destinationAssetId,
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
}

