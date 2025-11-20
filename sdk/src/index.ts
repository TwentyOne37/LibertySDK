import axios, { AxiosInstance } from 'axios';

export type PaymentMode = 'cheapest' | 'privacy' | 'manual';

export interface CreatePaymentIntentParams {
  merchantId: string;
  amount: string;        // decimal string
  currency: string;      // e.g. "USD"
  payoutAsset: string;   // e.g. "USDC"
  payoutChain: string;   // e.g. "ethereum"
  mode?: PaymentMode;    // default 'cheapest'
}

export interface PaymentIntent {
  id: string;
  merchantId: string;
  amount: string;
  currency: string;
  payoutAsset: string;
  payoutChain: string;
  status: string;
  mode: string; // The backend returns uppercase
  provider?: string | null;
  intentsDepositAddress?: string | null;
  expectedAmountInZec?: string | null;
  intentsRawQuote?: any;
  // EVM fields
  oneInchChainId?: number | null;
  oneInchFromToken?: string | null;
  oneInchToToken?: string | null;
  oneInchQuote?: any;
  oneInchTxHash?: string | null;
  oneInchStatus?: string | null;
}

export interface PaymentStatus {
  id: string;
  status: string;
  provider?: string | null;
  amount: string;
  currency: string;
  payoutAsset: string;
  payoutChain: string;
  // EVM fields
  oneInchStatus?: string | null;
  oneInchTxHash?: string | null;
}

export interface QuoteEvmParams {
  paymentIntentId: string;
  chainId: number;
  fromTokenAddress: string;
  fromTokenDecimals: number;
  amountDecimal: string;
}

export interface BuildSwapTxParams {
  paymentIntentId: string;
  chainId: number;
  fromTokenAddress: string;
  userAddress: string;
  slippageBps: number;
}

export interface OneInchQuote {
  dstAmount: string;
  [key: string]: any;
}

export interface OneInchSwapTx {
  to: string;
  data: string;
  value: string;
  gas: number;
}

export interface LibertyPayClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class LibertyPayClient {
  private client: AxiosInstance;

  constructor(private options: LibertyPayClientOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      headers: options.apiKey ? { 'x-api-key': options.apiKey } : {},
    });
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    try {
      // Map lowercase mode to uppercase for backend
      const modeMap: Record<PaymentMode, string> = {
        'cheapest': 'CHEAPEST',
        'privacy': 'PRIVACY',
        'manual': 'MANUAL'
      };
      
      const backendMode = params.mode ? modeMap[params.mode] : 'CHEAPEST';

      const response = await this.client.post<PaymentIntent>('/payment-intents', {
        ...params,
        mode: backendMode,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create payment intent: ${error.response?.data?.message || error.message}`);
    }
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    try {
      const response = await this.client.get<PaymentIntent>(`/payment-intents/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get payment intent: ${error.response?.data?.message || error.message}`);
    }
  }

  async getStatus(id: string): Promise<PaymentStatus> {
    try {
      const response = await this.client.get<PaymentStatus>(`/payment-intents/${id}/status`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get payment status: ${error.response?.data?.message || error.message}`);
    }
  }

  async quoteEvm(params: QuoteEvmParams): Promise<{ quote: OneInchQuote; expectedAmountOut: string }> {
    try {
      const response = await this.client.post(`payment-intents/${params.paymentIntentId}/quote-evm`, {
        chainId: params.chainId,
        fromTokenAddress: params.fromTokenAddress,
        fromTokenDecimals: params.fromTokenDecimals,
        amountDecimal: params.amountDecimal,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to quote EVM: ${error.response?.data?.message || error.message}`);
    }
  }

  async buildEvmSwapTx(params: BuildSwapTxParams): Promise<OneInchSwapTx> {
    try {
      const response = await this.client.post(`payment-intents/${params.paymentIntentId}/evm-swap-tx`, {
        chainId: params.chainId,
        fromTokenAddress: params.fromTokenAddress,
        userAddress: params.userAddress,
        slippageBps: params.slippageBps,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to build EVM swap tx: ${error.response?.data?.message || error.message}`);
    }
  }

  async confirmEvmTx(paymentIntentId: string, txHash: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post(`payment-intents/${paymentIntentId}/evm-tx-confirm`, {
        txHash,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to confirm EVM tx: ${error.response?.data?.message || error.message}`);
    }
  }
}
