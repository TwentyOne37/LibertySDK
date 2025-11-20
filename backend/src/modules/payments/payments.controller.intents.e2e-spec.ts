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

describe('PaymentsController Intents (ZEC) (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let nearIntentsClient: jest.Mocked<NearIntentsClient>;

  const mockMerchant = {
    id: 'merchant-1',
    name: 'Test Merchant',
    payoutAsset: 'USDC',
    payoutChain: 'ETHEREUM',
    payoutAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentIntent = {
    id: 'payment-intent-zec-1',
    merchantId: 'merchant-1',
    amount: '100.00',
    currency: 'USD',
    payoutAsset: 'USDC',
    payoutChain: 'ETHEREUM',
    status: 'CREATED' as const,
    mode: PaymentIntentMode.CHEAPEST,
    provider: null,
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
        },
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
         payoutChain: 'ETHEREUM',
         mode: PaymentIntentMode.CHEAPEST,
       };
       
       (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue(mockPaymentIntent);

       return request(app.getHttpServer())
         .post('/payment-intents')
         .send(createDto)
         .expect(201)
         .expect((res) => {
           expect(res.body).toEqual(JSON.parse(JSON.stringify(mockPaymentIntent)));
           expect(prismaService.paymentIntent.create).toHaveBeenCalled();
         });
    });
  });

  describe('POST /payment-intents/:id/quote-zec', () => {
    const mockIntentsQuoteResponse = {
      depositAddress: 't1ZecDepositAddress',
      amount: '100000000', // atomic units for dest
      depositAmount: '0.5', // ZEC amount
      token: 'usdc-ethereum-mainnet',
    };

    it('should create zec quote and return details', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(mockIntentsQuoteResponse);
      
      const updatedIntent = {
        ...mockPaymentIntent,
        status: 'AWAITING_DEPOSIT',
        intentsDepositAddress: mockIntentsQuoteResponse.depositAddress,
      };

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(updatedIntent);

      return request(app.getHttpServer())
        .post(`/payment-intents/${mockPaymentIntent.id}/quote-zec`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
             depositAddress: mockIntentsQuoteResponse.depositAddress,
             expectedAmountInZec: mockIntentsQuoteResponse.depositAmount,
             status: 'AWAITING_DEPOSIT'
          });
          expect(nearIntentsClient.getQuoteWithDeposit).toHaveBeenCalled();
        });
    });

    it('should return 404 when payment intent not found', () => {
       (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(null);
       return request(app.getHttpServer())
         .post('/payment-intents/non-existent/quote-zec')
         .expect(404);
    });
    
    it('should handle missing deposit address in quote response', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue({}); // empty response

      return request(app.getHttpServer())
        .post(`/payment-intents/${mockPaymentIntent.id}/quote-zec`)
        .expect(400);
    });

    it('should fail if payment intent is not in CREATED status', () => {
      const nonCreatedIntent = { ...mockPaymentIntent, status: 'COMPLETED' };
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(nonCreatedIntent);

      return request(app.getHttpServer())
        .post(`/payment-intents/${mockPaymentIntent.id}/quote-zec`)
        .expect(400);
    });
  });

  describe('GET /payment-intents/:id/status', () => {
    it('should return status', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);

      return request(app.getHttpServer())
        .get(`/payment-intents/${mockPaymentIntent.id}/status`)
        .expect(200)
        .expect((res) => {
           expect(res.body.status).toBe('CREATED');
        });
    });

    it('should return 404 if not found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/payment-intents/non-existent-id/status')
        .expect(404);
    });
  });
});

