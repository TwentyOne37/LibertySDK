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

describe('PaymentsController EVM (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
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
    id: 'payment-intent-evm-1',
    merchantId: 'merchant-1',
    amount: '100.00',
    currency: 'USD',
    payoutAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    payoutChain: 'ethereum',
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
    // 1inch fields
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
    oneInchClient = moduleFixture.get(OneInchClient);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payment-intents/:id/quote-evm', () => {
    const mockEvmQuoteResponse = {
      dstAmount: '100000000', // 100 USDC
      // other 1inch fields
    };

    it('should create evm quote and return details', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );
      
      (oneInchClient.getQuote as jest.Mock).mockResolvedValue(
        mockEvmQuoteResponse,
      );

      const quoteDto = {
        chainId: 1,
        fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        fromTokenDecimals: 18,
        amountDecimal: '0.1',
      };

      // The service will calculate atomic units: 0.1 * 10^18 = 100000000000000000
      const atomicAmount = '100000000000000000';

      const updatedIntent = {
        ...mockPaymentIntent,
        provider: '1inch',
        oneInchChainId: quoteDto.chainId,
        oneInchFromToken: quoteDto.fromTokenAddress,
        oneInchToToken: mockPaymentIntent.payoutAsset,
        oneInchQuote: { ...mockEvmQuoteResponse, inputAmount: atomicAmount },
        status: 'AWAITING_DEPOSIT',
      };

      (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue(
        updatedIntent,
      );

      return request(app.getHttpServer())
        .post(`/payment-intents/${mockPaymentIntent.id}/quote-evm`)
        .send(quoteDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({
            quote: expect.objectContaining({
               dstAmount: mockEvmQuoteResponse.dstAmount,
               inputAmount: atomicAmount,
            }),
            expectedAmountOut: mockEvmQuoteResponse.dstAmount,
          });
          expect(oneInchClient.getQuote).toHaveBeenCalledWith({
             chainId: quoteDto.chainId,
             fromTokenAddress: quoteDto.fromTokenAddress,
             toTokenAddress: mockPaymentIntent.payoutAsset,
             amount: atomicAmount,
          });
        });
    });

    it('should return 404 when payment intent not found', () => {
      (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/payment-intents/non-existent-id/quote-evm')
        .send({
          chainId: 1,
          fromTokenAddress: '0xeth',
          fromTokenDecimals: 18,
          amountDecimal: '1.0',
        })
        .expect(404);
    });
  });

  describe('POST /payment-intents/:id/evm-swap-tx', () => {
     const mockQuoteInDb = {
         dstAmount: '100000000',
         inputAmount: '100000000000000000',
     };
     
     const mockTxResponse = {
         to: '0x1inchRouter',
         data: '0xcalldata',
         value: '100000000000000000',
         gas: 200000
     };

     const intentWithQuote = {
         ...mockPaymentIntent,
         oneInchQuote: mockQuoteInDb,
     };

     it('should build swap tx using stored quote', () => {
         (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(intentWithQuote);
         (oneInchClient.buildSwapTx as jest.Mock).mockResolvedValue(mockTxResponse);

         const buildTxDto = {
             chainId: 1,
             fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
             userAddress: '0xUserAddress',
             slippageBps: 100,
         };

         return request(app.getHttpServer())
             .post(`/payment-intents/${mockPaymentIntent.id}/evm-swap-tx`)
             .send(buildTxDto)
             .expect(201)
             .expect((res) => {
                 expect(res.body).toEqual(mockTxResponse);
                 expect(oneInchClient.buildSwapTx).toHaveBeenCalledWith({
                     chainId: buildTxDto.chainId,
                     fromTokenAddress: buildTxDto.fromTokenAddress,
                     toTokenAddress: intentWithQuote.payoutAsset,
                     amount: mockQuoteInDb.inputAmount,
                     fromAddress: buildTxDto.userAddress,
                     slippage: 1, // 100 bps / 100 = 1%
                 });
             });
     });

     it('should return 400 if quote is missing', () => {
         (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent); // No quote

         return request(app.getHttpServer())
             .post(`/payment-intents/${mockPaymentIntent.id}/evm-swap-tx`)
             .send({
                chainId: 1,
                fromTokenAddress: '0xeth',
                userAddress: '0xuser',
                slippageBps: 100,
             })
             .expect(400)
             .expect((res) => {
                 expect(res.body.message).toContain('No valid 1inch quote found');
             });
     });
  });

  describe('POST /payment-intents/:id/evm-tx-confirm', () => {
      it('should confirm tx and complete payment', () => {
          (prismaService.paymentIntent.findUnique as jest.Mock).mockResolvedValue(mockPaymentIntent);
          (prismaService.paymentIntent.update as jest.Mock).mockResolvedValue({
              ...mockPaymentIntent,
              status: 'COMPLETED',
              oneInchStatus: 'SUCCESS',
              oneInchTxHash: '0xtxhash'
          });

          return request(app.getHttpServer())
              .post(`/payment-intents/${mockPaymentIntent.id}/evm-tx-confirm`)
              .send({ txHash: '0xtxhash' })
              .expect(201)
              .expect((res) => {
                  expect(res.body).toEqual({ success: true });
                  expect(prismaService.paymentIntent.update).toHaveBeenCalledWith({
                      where: { id: mockPaymentIntent.id },
                      data: expect.objectContaining({
                          oneInchTxHash: '0xtxhash',
                          status: 'COMPLETED',
                      })
                  });
              });
      });
  });
});

