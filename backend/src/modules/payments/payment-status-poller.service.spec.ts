import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PaymentStatusPollerService } from './payment-status-poller.service';
import { PrismaService } from '../prisma/prisma.service';
import { NearIntentsClient } from '../../integrations/near-intents.client';

// Extract the mapping function for testing
function mapIntentsStatusToPaymentStatus(
  intentsStatus: string,
): 'CREATED' | 'AWAITING_DEPOSIT' | 'SWAPPING' | 'COMPLETED' | 'FAILED' {
  const statusUpper = intentsStatus.toUpperCase();

  switch (statusUpper) {
    case 'PENDING_DEPOSIT':
      return 'AWAITING_DEPOSIT';
    case 'PROCESSING':
      return 'SWAPPING';
    case 'SUCCESS':
      return 'COMPLETED';
    case 'FAILED':
    case 'INCOMPLETE_DEPOSIT':
      return 'FAILED';
    default:
      return 'AWAITING_DEPOSIT';
  }
}

describe('PaymentStatusPollerService', () => {
  let service: PaymentStatusPollerService;
  let prismaService: jest.Mocked<PrismaService>;
  let nearIntentsClient: jest.Mocked<NearIntentsClient>;

  beforeEach(async () => {
    const mockPrismaService = {
      paymentIntent: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const mockNearIntentsClient = {
      getStatus: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentStatusPollerService,
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

    service = module.get<PaymentStatusPollerService>(PaymentStatusPollerService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    nearIntentsClient = module.get(NearIntentsClient) as jest.Mocked<NearIntentsClient>;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('mapIntentsStatusToPaymentStatus', () => {
    it('should map PENDING_DEPOSIT to AWAITING_DEPOSIT', () => {
      expect(mapIntentsStatusToPaymentStatus('PENDING_DEPOSIT')).toBe(
        'AWAITING_DEPOSIT',
      );
    });

    it('should map PROCESSING to SWAPPING', () => {
      expect(mapIntentsStatusToPaymentStatus('PROCESSING')).toBe('SWAPPING');
    });

    it('should map SUCCESS to COMPLETED', () => {
      expect(mapIntentsStatusToPaymentStatus('SUCCESS')).toBe('COMPLETED');
    });

    it('should map FAILED to FAILED', () => {
      expect(mapIntentsStatusToPaymentStatus('FAILED')).toBe('FAILED');
    });

    it('should map INCOMPLETE_DEPOSIT to FAILED', () => {
      expect(mapIntentsStatusToPaymentStatus('INCOMPLETE_DEPOSIT')).toBe(
        'FAILED',
      );
    });

    it('should handle case-insensitive status mapping', () => {
      expect(mapIntentsStatusToPaymentStatus('pending_deposit')).toBe(
        'AWAITING_DEPOSIT',
      );
      expect(mapIntentsStatusToPaymentStatus('Processing')).toBe('SWAPPING');
      expect(mapIntentsStatusToPaymentStatus('success')).toBe('COMPLETED');
    });

    it('should default to AWAITING_DEPOSIT for unknown statuses', () => {
      expect(mapIntentsStatusToPaymentStatus('UNKNOWN_STATUS')).toBe(
        'AWAITING_DEPOSIT',
      );
      expect(mapIntentsStatusToPaymentStatus('')).toBe('AWAITING_DEPOSIT');
    });
  });

  describe('pollStatuses', () => {
    const mockPaymentIntent = {
      id: 'payment-intent-1',
      merchantId: 'merchant-1',
      amount: '100.00',
      currency: 'USD',
      payoutAsset: 'USDC',
      payoutChain: 'ethereum',
      status: 'AWAITING_DEPOSIT' as const,
      mode: 'CHEAPEST' as const,
      provider: 'intents',
      providerMetadata: null,
      intentsDepositAddress: 'deposit-address-123',
      intentsOriginAssetId: 'zec-mainnet',
      intentsDestinationAssetId: 'usdc-ethereum-mainnet',
      intentsSwapType: 'EXACT_OUTPUT',
      intentsRawQuote: null,
      intentsStatus: 'PENDING_DEPOSIT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update payment intent status when status changes', async () => {
      // Arrange
      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([
        mockPaymentIntent,
      ]);
      (nearIntentsClient.getStatus as jest.Mock).mockResolvedValue({
        depositAddress: 'deposit-address-123',
        status: 'PROCESSING',
        txHash: '0xabc123',
      });
      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue({
        ...mockPaymentIntent,
        status: 'SWAPPING',
      });

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(prismaService.paymentIntent.findMany as jest.Mock).toHaveBeenCalledWith({
        where: {
          provider: 'intents',
          status: {
            in: ['AWAITING_DEPOSIT', 'SWAPPING'],
          },
          intentsDepositAddress: {
            not: null,
          },
        },
      });

      expect(nearIntentsClient.getStatus as jest.Mock).toHaveBeenCalledWith(
        'deposit-address-123',
      );

      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledWith({
        where: { id: 'payment-intent-1' },
        data: {
          status: 'SWAPPING',
          intentsStatus: 'PROCESSING',
          providerMetadata: {
            txHash: '0xabc123',
          },
        },
      });
    });

    it('should not update payment intent when status has not changed', async () => {
      // Arrange
      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([
        mockPaymentIntent,
      ]);
      (nearIntentsClient.getStatus as jest.Mock).mockResolvedValue({
        depositAddress: 'deposit-address-123',
        status: 'PENDING_DEPOSIT', // Same as current status
      });

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(nearIntentsClient.getStatus).toHaveBeenCalled();
      expect(prismaService.paymentIntent.update as jest.Mock).not.toHaveBeenCalled();
    });

    it('should handle multiple payment intents', async () => {
      // Arrange
      const intent1 = { ...mockPaymentIntent, id: 'payment-intent-1' };
      const intent2 = {
        ...mockPaymentIntent,
        id: 'payment-intent-2',
        intentsDepositAddress: 'deposit-address-456',
      };

      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([intent1, intent2]);
      (nearIntentsClient.getStatus as jest.Mock)
        .mockResolvedValueOnce({
          depositAddress: 'deposit-address-123',
          status: 'SUCCESS',
        })
        .mockResolvedValueOnce({
          depositAddress: 'deposit-address-456',
          status: 'FAILED',
        });

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(mockPaymentIntent);

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(nearIntentsClient.getStatus as jest.Mock).toHaveBeenCalledTimes(2);
      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledTimes(2);
    });

    it('should skip payment intents without deposit address', async () => {
      // Arrange
      const intentWithoutAddress = {
        ...mockPaymentIntent,
        intentsDepositAddress: null,
      };
      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([
        intentWithoutAddress,
      ]);

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(nearIntentsClient.getStatus as jest.Mock).not.toHaveBeenCalled();
      expect(prismaService.paymentIntent.update as jest.Mock).not.toHaveBeenCalled();
    });

    it('should continue polling other intents when one fails', async () => {
      // Arrange
      const intent1 = { ...mockPaymentIntent, id: 'payment-intent-1' };
      const intent2 = {
        ...mockPaymentIntent,
        id: 'payment-intent-2',
        intentsDepositAddress: 'deposit-address-456',
      };

      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([intent1, intent2]);
      (nearIntentsClient.getStatus as jest.Mock)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          depositAddress: 'deposit-address-456',
          status: 'SUCCESS',
        });

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(mockPaymentIntent);

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(nearIntentsClient.getStatus as jest.Mock).toHaveBeenCalledTimes(2);
      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledTimes(1);
      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledWith({
        where: { id: 'payment-intent-2' },
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      });
    });

    it('should preserve existing providerMetadata when updating txHash', async () => {
      // Arrange
      const intentWithMetadata = {
        ...mockPaymentIntent,
        providerMetadata: {
          existingField: 'existingValue',
        },
      };

      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([
        intentWithMetadata,
      ]);
      (nearIntentsClient.getStatus as jest.Mock).mockResolvedValue({
        depositAddress: 'deposit-address-123',
        status: 'PROCESSING',
        txHash: '0xnewhash',
      });
      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(mockPaymentIntent);

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledWith({
        where: { id: 'payment-intent-1' },
        data: {
          status: 'SWAPPING',
          intentsStatus: 'PROCESSING',
          providerMetadata: {
            existingField: 'existingValue',
            txHash: '0xnewhash',
          },
        },
      });
    });

    it('should handle status response without txHash', async () => {
      // Arrange
      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([
        mockPaymentIntent,
      ]);
      (nearIntentsClient.getStatus as jest.Mock).mockResolvedValue({
        depositAddress: 'deposit-address-123',
        status: 'SUCCESS',
        // No txHash
      });
      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(mockPaymentIntent);

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(prismaService.paymentIntent.update as jest.Mock).toHaveBeenCalledWith({
        where: { id: 'payment-intent-1' },
        data: {
          status: 'COMPLETED',
          intentsStatus: 'SUCCESS',
          providerMetadata: null,
        },
      });
    });

    it('should handle errors during findMany gracefully', async () => {
      // Arrange
      (prismaService.paymentIntent.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      await (service as any).pollStatuses();

      // Assert
      expect(nearIntentsClient.getStatus as jest.Mock).not.toHaveBeenCalled();
    });
  });
});

