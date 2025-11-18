import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NearIntentsClient } from '../../integrations/near-intents.client';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentIntentMode } from './dto/create-payment-intent.dto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: jest.Mocked<PrismaService>;
  let nearIntentsClient: jest.Mocked<NearIntentsClient>;

  const mockMerchant = {
    id: 'merchant-1',
    name: 'Test Merchant',
    payoutAsset: 'USDC',
    payoutChain: 'ethereum',
    payoutAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentIntent = {
    id: 'payment-intent-1',
    merchantId: 'merchant-1',
    amount: '100.00',
    currency: 'USD',
    payoutAsset: 'USDC',
    payoutChain: 'ethereum',
    status: 'CREATED' as const,
    mode: PaymentIntentMode.CHEAPEST,
    provider: 'intents',
    providerMetadata: null,
    intentsDepositAddress: null,
    intentsOriginAssetId: null,
    intentsDestinationAssetId: null,
    intentsSwapType: null,
    intentsRawQuote: null,
    intentsStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    merchant: mockMerchant,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      paymentIntent: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const mockNearIntentsClient = {
      getQuoteWithDeposit: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NearIntentsClient,
          useValue: mockNearIntentsClient,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    nearIntentsClient = module.get(NearIntentsClient) as jest.Mocked<NearIntentsClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a payment intent with CREATED status', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        merchantId: 'merchant-1',
        amount: '100.00',
        currency: 'USD',
        payoutAsset: 'USDC',
        payoutChain: 'ethereum',
        mode: PaymentIntentMode.CHEAPEST,
      };

      const expectedPaymentIntent = {
        ...mockPaymentIntent,
        ...dto,
        status: 'CREATED',
        provider: 'intents',
      };

      (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue(expectedPaymentIntent);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toEqual(expectedPaymentIntent);
      expect(prismaService.paymentIntent.create as jest.Mock).toHaveBeenCalledWith({
        data: {
          merchantId: dto.merchantId,
          amount: dto.amount,
          currency: dto.currency,
          payoutAsset: dto.payoutAsset,
          payoutChain: dto.payoutChain,
          mode: dto.mode,
          status: 'CREATED',
          provider: 'intents',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a payment intent with merchant when found', async () => {
      // Arrange
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);

      // Act
      const result = await service.findOne('payment-intent-1');

      // Assert
      expect(result).toEqual(mockPaymentIntent);
      expect(prismaService.paymentIntent.findUnique as jest.Mock).toHaveBeenCalledWith({
        where: { id: 'payment-intent-1' },
        include: { merchant: true },
      });
    });

    it('should return null when payment intent not found', async () => {
      // Arrange
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.findOne('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return payment intent status when found', async () => {
      // Arrange
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);

      // Act
      const result = await service.getStatus('payment-intent-1');

      // Assert
      expect(result).toEqual({
        id: mockPaymentIntent.id,
        status: mockPaymentIntent.status,
        provider: mockPaymentIntent.provider,
        payoutAsset: mockPaymentIntent.payoutAsset,
        payoutChain: mockPaymentIntent.payoutChain,
        amount: mockPaymentIntent.amount,
        currency: mockPaymentIntent.currency,
      });
    });

    it('should throw NotFoundException when payment intent does not exist', async () => {
      // Arrange
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getStatus('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getStatus('non-existent-id')).rejects.toThrow(
        'Payment intent with ID non-existent-id not found',
      );
    });
  });

  describe('quoteZec', () => {
    const mockQuoteResponse = {
      depositAddress: 'deposit-address-123',
      depositAmount: '0.5',
      amount: '0.5',
      token: 'zec-mainnet',
      estimatedTime: 300,
    };

    it('should create quote and update payment intent status to AWAITING_DEPOSIT', async () => {
      // Arrange
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(mockQuoteResponse);

      const updatedIntent = {
        ...mockPaymentIntent,
        intentsDepositAddress: mockQuoteResponse.depositAddress,
        intentsOriginAssetId: 'zec-mainnet',
        intentsDestinationAssetId: 'usdc-ethereum-mainnet',
        intentsSwapType: 'EXACT_OUTPUT',
        intentsRawQuote: mockQuoteResponse,
        intentsStatus: 'PENDING_DEPOSIT',
        provider: 'intents',
        status: 'AWAITING_DEPOSIT' as const,
      };

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(updatedIntent);

      // Act
      const result = await service.quoteZec('payment-intent-1');

      // Assert
      expect(result).toEqual({
        depositAddress: mockQuoteResponse.depositAddress,
        expectedAmountInZec: mockQuoteResponse.depositAmount,
        payoutAsset: mockPaymentIntent.payoutAsset,
        payoutChain: mockPaymentIntent.payoutChain,
        paymentIntentId: updatedIntent.id,
        status: 'AWAITING_DEPOSIT',
      });

      expect(nearIntentsClient.getQuoteWithDeposit as jest.Mock).toHaveBeenCalledWith({
        originAsset: 'zec-mainnet',
        destinationAsset: 'usdc-ethereum-mainnet',
        swapType: 'EXACT_OUTPUT',
        amount: mockPaymentIntent.amount,
        destinationAddress: mockMerchant.payoutAddress,
        slippageTolerance: 50,
      });

      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledWith({
        where: { id: 'payment-intent-1' },
        data: {
          intentsDepositAddress: mockQuoteResponse.depositAddress,
          intentsOriginAssetId: 'zec-mainnet',
          intentsDestinationAssetId: 'usdc-ethereum-mainnet',
          intentsSwapType: 'EXACT_OUTPUT',
          intentsRawQuote: mockQuoteResponse,
          intentsStatus: 'PENDING_DEPOSIT',
          provider: 'intents',
          status: 'AWAITING_DEPOSIT',
        },
        include: {
          merchant: true,
        },
      });
    });

    it('should use amount when depositAmount is not available', async () => {
      // Arrange
      const quoteWithoutDepositAmount = {
        ...mockQuoteResponse,
        depositAmount: undefined,
        amount: '0.6',
      };

      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(quoteWithoutDepositAmount);

      const updatedIntent = {
        ...mockPaymentIntent,
        status: 'AWAITING_DEPOSIT' as const,
      };

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(updatedIntent);

      // Act
      const result = await service.quoteZec('payment-intent-1');

      // Assert
      expect(result.expectedAmountInZec).toBe('0.6');
    });

    it('should throw NotFoundException when payment intent does not exist', async () => {
      // Arrange
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.quoteZec('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.quoteZec('non-existent-id')).rejects.toThrow(
        'Payment intent with ID non-existent-id not found',
      );
      expect(nearIntentsClient.getQuoteWithDeposit as jest.Mock).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payment intent is not in CREATED status', async () => {
      // Arrange
      const intentInProgress = {
        ...mockPaymentIntent,
        status: 'AWAITING_DEPOSIT' as const,
      };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(intentInProgress);

      // Act & Assert
      await expect(service.quoteZec('payment-intent-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.quoteZec('payment-intent-1')).rejects.toThrow(
        'Payment intent is in AWAITING_DEPOSIT status. Only CREATED intents can be quoted.',
      );
      expect(nearIntentsClient.getQuoteWithDeposit as jest.Mock).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payout asset/chain is unsupported', async () => {
      // Arrange
      const unsupportedIntent = {
        ...mockPaymentIntent,
        payoutAsset: 'UNSUPPORTED',
        payoutChain: 'unknown-chain',
      };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(unsupportedIntent);

      // Act & Assert
      await expect(service.quoteZec('payment-intent-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.quoteZec('payment-intent-1')).rejects.toThrow(
        'Failed to determine destination token ID',
      );
      expect(nearIntentsClient.getQuoteWithDeposit as jest.Mock).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive payout asset and chain matching', async () => {
      // Arrange
      const intentWithDifferentCase = {
        ...mockPaymentIntent,
        payoutAsset: 'usdc',
        payoutChain: 'Ethereum',
      };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(intentWithDifferentCase);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(mockQuoteResponse);

      const updatedIntent = {
        ...intentWithDifferentCase,
        status: 'AWAITING_DEPOSIT' as const,
      };
      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(updatedIntent);

      // Act
      await service.quoteZec('payment-intent-1');

      // Assert
      expect(nearIntentsClient.getQuoteWithDeposit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when deposit address is missing from quote response', async () => {
      // Arrange
      const quoteWithoutAddress = {
        ...mockQuoteResponse,
        depositAddress: undefined,
      };

      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(quoteWithoutAddress);

      // Act & Assert
      await expect(service.quoteZec('payment-intent-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.quoteZec('payment-intent-1')).rejects.toThrow(
        'Failed to get deposit address from Intents API',
      );
      expect(prismaService.paymentIntent.update as jest.Mock).not.toHaveBeenCalled();
    });

    it('should handle Ethereum chain name variations', async () => {
      // Arrange
      const intentWithEthereumVariation = {
        ...mockPaymentIntent,
        payoutChain: 'ethereum-mainnet',
      };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(intentWithEthereumVariation);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(mockQuoteResponse);

      const updatedIntent = {
        ...intentWithEthereumVariation,
        status: 'AWAITING_DEPOSIT' as const,
      };
      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(updatedIntent);

      // Act
      await service.quoteZec('payment-intent-1');

      // Assert
      expect(nearIntentsClient.getQuoteWithDeposit).toHaveBeenCalled();
    });
  });
});

