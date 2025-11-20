import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentStatusPollerService } from './payment-status-poller.service';
import { PrismaService } from '../prisma/prisma.service';
import { NearIntentsClient } from '../../integrations/near-intents.client';
import { OneInchClient } from '../../integrations/oneinch.client';
import { PaymentIntentMode } from './dto/create-payment-intent.dto';

describe('PaymentsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let nearIntentsClient: jest.Mocked<NearIntentsClient>;
  let oneInchClient: jest.Mocked<OneInchClient>;

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
    oneInchChainId: null,
    oneInchFromToken: null,
    oneInchToToken: null,
    oneInchQuote: null,
    oneInchTxHash: null,
    oneInchStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    merchant: mockMerchant,
  };

  beforeAll(async () => {
    const mockNearIntentsClient = {
      getQuoteWithDeposit: jest.fn(),
      getStatus: jest.fn(),
      getQuoteDry: jest.fn(),
      getTokens: jest.fn(),
    };

    const mockOneInchClient = {
        getQuote: jest.fn(),
        buildSwapTx: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        {
          provide: PaymentStatusPollerService,
          useValue: {
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            paymentIntent: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            merchant: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: NearIntentsClient,
          useValue: mockNearIntentsClient,
        },
        {
            provide: OneInchClient,
            useValue: mockOneInchClient,
        }
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    nearIntentsClient = moduleFixture.get(NearIntentsClient);
    oneInchClient = moduleFixture.get(OneInchClient);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payment-intents', () => {
    it('should create a payment intent', () => {
      const createDto = {
        merchantId: 'merchant-1',
        amount: '100.00',
        currency: 'USD',
        payoutAsset: 'USDC',
        payoutChain: 'ethereum',
        mode: PaymentIntentMode.CHEAPEST,
      };

      (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue({
        ...mockPaymentIntent,
        ...createDto,
      });

      return request(app.getHttpServer())
        .post('/payment-intents')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            merchantId: createDto.merchantId,
            amount: createDto.amount,
            currency: createDto.currency,
            payoutAsset: createDto.payoutAsset,
            payoutChain: createDto.payoutChain,
            mode: createDto.mode,
            status: 'CREATED',
            provider: 'intents',
          });
        });
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/payment-intents')
        .send({
          merchantId: 'merchant-1',
          // Missing other required fields
        })
        .expect(400);
    });

    it('should return 400 when mode is invalid', () => {
      return request(app.getHttpServer())
        .post('/payment-intents')
        .send({
          merchantId: 'merchant-1',
          amount: '100.00',
          currency: 'USD',
          payoutAsset: 'USDC',
          payoutChain: 'ethereum',
          mode: 'INVALID_MODE',
        })
        .expect(400);
    });

    it('should return 400 when mode is missing', () => {
      return request(app.getHttpServer())
        .post('/payment-intents')
        .send({
          merchantId: 'merchant-1',
          amount: '100.00',
          currency: 'USD',
          payoutAsset: 'USDC',
          payoutChain: 'ethereum',
        })
        .expect(400);
    });
  });

  describe('GET /payment-intents/:id', () => {
    it('should return a payment intent when found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      return request(app.getHttpServer())
        .get('/payment-intents/payment-intent-1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            id: mockPaymentIntent.id,
            merchantId: mockPaymentIntent.merchantId,
            amount: mockPaymentIntent.amount,
            status: mockPaymentIntent.status,
          });
          expect(res.body.merchant).toBeDefined();
        });
    });

    it('should return 404 when payment intent not found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      return request(app.getHttpServer())
        .get('/payment-intents/non-existent-id')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('GET /payment-intents/:id/status', () => {
    it('should return payment intent status when found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      return request(app.getHttpServer())
        .get('/payment-intents/payment-intent-1/status')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            id: mockPaymentIntent.id,
            status: mockPaymentIntent.status,
            provider: mockPaymentIntent.provider,
            payoutAsset: mockPaymentIntent.payoutAsset,
            payoutChain: mockPaymentIntent.payoutChain,
            amount: mockPaymentIntent.amount,
            currency: mockPaymentIntent.currency,
            oneInchStatus: mockPaymentIntent.oneInchStatus,
            oneInchTxHash: mockPaymentIntent.oneInchTxHash
          });
        });
    });

    it('should return 404 when payment intent not found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      return request(app.getHttpServer())
        .get('/payment-intents/non-existent-id/status')
        .expect(404);
    });
  });

  describe('POST /payment-intents/:id/quote-zec', () => {
    const mockQuoteResponse = {
      depositAddress: 'deposit-address-123',
      depositAmount: '0.5',
      amount: '0.5',
      token: 'zec-mainnet',
      estimatedTime: 300,
    };

    it('should create quote and return deposit address', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(
        mockQuoteResponse,
      );

      const updatedIntent = {
        ...mockPaymentIntent,
        intentsDepositAddress: mockQuoteResponse.depositAddress,
        intentsOriginAssetId: 'zec-mainnet',
        intentsDestinationAssetId: 'usdc-ethereum-mainnet',
        intentsSwapType: 'EXACT_OUTPUT',
        intentsRawQuote: mockQuoteResponse,
        intentsStatus: 'PENDING_DEPOSIT',
        status: 'AWAITING_DEPOSIT' as const,
      };

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(
        updatedIntent,
      );

      return request(app.getHttpServer())
        .post('/payment-intents/payment-intent-1/quote-zec')
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            depositAddress: mockQuoteResponse.depositAddress,
            expectedAmountInZec: mockQuoteResponse.depositAmount,
            payoutAsset: mockPaymentIntent.payoutAsset,
            payoutChain: mockPaymentIntent.payoutChain,
            paymentIntentId: updatedIntent.id,
            status: 'AWAITING_DEPOSIT',
          });
        });
    });

    it('should return 404 when payment intent not found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      return request(app.getHttpServer())
        .post('/payment-intents/non-existent-id/quote-zec')
        .expect(404);
    });

    it('should return 400 when payment intent is not in CREATED status', () => {
      const intentInProgress = {
        ...mockPaymentIntent,
        status: 'AWAITING_DEPOSIT' as const,
      };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        intentInProgress,
      );

      return request(app.getHttpServer())
        .post('/payment-intents/payment-intent-1/quote-zec')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Only CREATED intents can be quoted');
        });
    });

    it('should return 400 when payout asset/chain is unsupported', () => {
      const unsupportedIntent = {
        ...mockPaymentIntent,
        payoutAsset: 'UNSUPPORTED',
        payoutChain: 'unknown-chain',
      };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        unsupportedIntent,
      );

      return request(app.getHttpServer())
        .post('/payment-intents/payment-intent-1/quote-zec')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Failed to determine destination token ID');
        });
    });

    it('should return 400 when deposit address is missing from quote', () => {
      const quoteWithoutAddress = {
        ...mockQuoteResponse,
        depositAddress: undefined,
      };

      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(
        quoteWithoutAddress,
      );

      return request(app.getHttpServer())
        .post('/payment-intents/payment-intent-1/quote-zec')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Failed to get deposit address');
        });
    });
  });
});
