import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { getOneInchConfig, OneInchConfig } from '../config/oneinch.config';

export interface OneInchQuote {
  dstAmount: string;
  // Add other fields as needed from 1inch response
  [key: string]: any;
}

export interface OneInchSwapTx {
  to: string;
  data: string;
  value: string;
  gas: number;
}

@Injectable()
export class OneInchClient {
  private readonly logger = new Logger(OneInchClient.name);
  private readonly config: OneInchConfig;
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.config = getOneInchConfig();
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  /**
   * Get a quote for a swap
   */
  async getQuote(params: {
    chainId: number;
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string; // atomic units
  }): Promise<OneInchQuote> {
    try {
      // API: /v6.0/{chainId}/quote
      const response = await this.httpClient.get(`/${params.chainId}/quote`, {
        params: {
          src: params.fromTokenAddress,
          dst: params.toTokenAddress,
          amount: params.amount,
          includeTokensInfo: true,
          includeProtocols: true,
          includeGas: true,
        },
      });
      return response.data;
    } catch (error) {
      this.handleError('get quote', error);
      throw error;
    }
  }

  /**
   * Build a swap transaction
   */
  async buildSwapTx(params: {
    chainId: number;
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string; // atomic units
    fromAddress: string;
    slippage: number; // percent e.g. 1 for 1%
  }): Promise<OneInchSwapTx> {
    try {
      // API: /v6.0/{chainId}/swap
      const response = await this.httpClient.get(`/${params.chainId}/swap`, {
        params: {
          src: params.fromTokenAddress,
          dst: params.toTokenAddress,
          amount: params.amount,
          from: params.fromAddress,
          slippage: params.slippage,
          disableEstimate: false,
          allowPartialFill: false,
        },
      });
      
      // 1inch Swap API returns a `tx` object in the response
      return response.data.tx;
    } catch (error) {
      this.handleError('build swap tx', error);
      throw error;
    }
  }

  private handleError(operation: string, error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      this.logger.error(
        `Failed to ${operation}: ${error.message}`,
        {
          status,
          data: JSON.stringify(data),
        },
      );
      throw new Error(
        `Failed to ${operation} from 1inch: ${data?.description || error.message}`,
      );
    }
    this.logger.error(`Failed to ${operation}: ${error.message}`, error.stack);
    throw error;
  }
}

