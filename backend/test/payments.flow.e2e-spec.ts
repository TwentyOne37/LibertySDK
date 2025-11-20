import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentStatusPollerService } from '../src/modules/payments/payment-status-poller.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { NearIntentsClient } from '../src/integrations/near-intents.client';
import { OneInchClient } from '../src/integrations/oneinch.client';
import { PaymentIntentMode } from '../src/modules/payments/dto/create-payment-intent.dto';

describe('Payments Flow (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let nearIntentsClient: jest.Mocked<NearIntentsClient>;
  let oneInchClient: jest.Mocked<OneInchClient>;

  const mockMerchant = {
    id: 'merchant-flow',
    name: 'Flow Merchant',
    payoutAsset: 'USDC',
    payoutChain: 'ETHEREUM',
    payoutAddress: '0xFlowMerchantAddress',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    oneInchClient = moduleFixture.get(OneInchClient);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ZEC Payment Flow', () => {
    it('should execute full ZEC payment lifecycle', async () => {
      // 1. Create Intent
      const createDto = {
        merchantId: mockMerchant.id,
        amount: '50.00',
        currency: 'USD',
        payoutAsset: 'USDC',
        payoutChain: 'ETHEREUM',
        mode: PaymentIntentMode.CHEAPEST,
      };

      const createdIntent = {
        id: 'flow-zec-1',
        ...createDto,
        status: 'CREATED',
        merchant: mockMerchant,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue(createdIntent);

      await request(app.getHttpServer())
        .post('/payment-intents')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe(createdIntent.id);
          expect(res.body.status).toBe('CREATED');
        });

      // 2. Get Quote (ZEC)
      const mockQuote = {
        depositAddress: 't1FlowZecAddress',
        amount: '50000000',
        depositAmount: '0.25',
      };

      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(createdIntent);
      (nearIntentsClient.getQuoteWithDeposit as jest.Mock).mockResolvedValue(mockQuote);

      const quotedIntent = {
        ...createdIntent,
        status: 'AWAITING_DEPOSIT',
        intentsDepositAddress: mockQuote.depositAddress,
      };
      
      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(quotedIntent);

      await request(app.getHttpServer())
        .post(`/payment-intents/${createdIntent.id}/quote-zec`)
        .expect(201)
        .expect((res) => {
           expect(res.body.depositAddress).toBe(mockQuote.depositAddress);
           expect(res.body.status).toBe('AWAITING_DEPOSIT');
        });

      // 3. Check Status (Simulate polling)
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(quotedIntent);
      
      await request(app.getHttpServer())
         .get(`/payment-intents/${createdIntent.id}/status`)
         .expect(200)
         .expect((res) => {
            expect(res.body.status).toBe('AWAITING_DEPOSIT');
            expect(res.body.payoutAsset).toBe('USDC');
         });
    });
  });

  describe('EVM Payment Flow', () => {
      it('should execute full EVM payment lifecycle', async () => {
          // 1. Create Intent
          const createDto = {
              merchantId: mockMerchant.id,
              amount: '20.00',
              currency: 'USD',
              payoutAsset: 'USDC',
              payoutChain: 'ETHEREUM',
              mode: PaymentIntentMode.CHEAPEST,
          };

          const createdIntent = {
              id: 'flow-evm-1',
              ...createDto,
              status: 'CREATED',
              merchant: mockMerchant,
              createdAt: new Date(),
              updatedAt: new Date(),
          };

          (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue(createdIntent);

          await request(app.getHttpServer())
              .post('/payment-intents')
              .send(createDto)
              .expect(201);

          // 2. Get Quote (EVM)
          const quoteDto = {
              chainId: 1,
              fromTokenAddress: '0xEthToken',
              fromTokenDecimals: 18,
              amountDecimal: '0.01',
          };

          const mockOneInchQuote = {
              dstAmount: '20000000', // 20 USDC
          };

          (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(createdIntent);
          (oneInchClient.getQuote as jest.Mock).mockResolvedValue(mockOneInchQuote);

          const quotedIntent = {
              ...createdIntent,
              status: 'AWAITING_DEPOSIT',
              oneInchQuote: { ...mockOneInchQuote, inputAmount: '10000000000000000' },
          };

          (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(quotedIntent);

          await request(app.getHttpServer())
              .post(`/payment-intents/${createdIntent.id}/quote-evm`)
              .send(quoteDto)
              .expect(201);
          
          // 3. Build TX
          const txResponse = {
              to: '0xRouter',
              data: '0xData',
              value: '0',
          };

          (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(quotedIntent);
          (oneInchClient.buildSwapTx as jest.Mock).mockResolvedValue(txResponse);

          await request(app.getHttpServer())
              .post(`/payment-intents/${createdIntent.id}/evm-swap-tx`)
              .send({
                  chainId: 1,
                  fromTokenAddress: '0xEthToken',
                  userAddress: '0xUser',
                  slippageBps: 50,
              })
              .expect(201)
              .expect((res) => {
                  expect(res.body).toEqual(txResponse);
              });

          // 4. Confirm TX
          const completedIntent = {
              ...quotedIntent,
              status: 'COMPLETED',
              oneInchTxHash: '0xHash',
          };

          (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(quotedIntent);
          (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(completedIntent);

          await request(app.getHttpServer())
              .post(`/payment-intents/${createdIntent.id}/evm-tx-confirm`)
              .send({ txHash: '0xHash' })
              .expect(201)
              .expect((res) => {
                  expect(res.body.success).toBe(true);
              });
      });
  });
});

