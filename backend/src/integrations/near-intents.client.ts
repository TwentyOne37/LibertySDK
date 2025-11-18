import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { getNearIntentsConfig, NearIntentsConfig } from '../config/near-intents.config';
import { IntentsQuoteParams } from './intents-quote-params';

export interface NearIntentsToken {
  address: string;
  symbol: string;
  decimals: number;
  chainId: string;
}

export interface NearIntentsQuoteResponse {
  depositAddress?: string;
  amount?: string;
  token?: string;
  estimatedTime?: number;
  depositAmount?: string;
  depositToken?: string;
  [key: string]: any; // Allow additional fields from API
}

export interface NearIntentsStatusResponse {
  depositAddress: string;
  status: string; // 'PENDING_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'INCOMPLETE_DEPOSIT'
  txHash?: string;
  [key: string]: any; // Allow additional fields from API
}

@Injectable()
export class NearIntentsClient {
  private readonly config: NearIntentsConfig;
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.config = getNearIntentsConfig();
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      headers: this.config.jwtToken
        ? {
            Authorization: `Bearer ${this.config.jwtToken}`,
          }
        : {},
    });
  }

  /**
   * Get available tokens for NEAR Intents
   */
  async getTokens(): Promise<NearIntentsToken[]> {
    try {
      const response = await this.httpClient.get('/v0/tokens');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to fetch tokens from NEAR Intents: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Get a quote for a payment intent (dry run, no deposit address)
   */
  async getQuoteDry(params: IntentsQuoteParams): Promise<NearIntentsQuoteResponse> {
    try {
      const response = await this.httpClient.post('/v0/quote', {
        ...params,
        dry: true,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to get quote from NEAR Intents: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Get a quote with deposit address for a payment intent
   */
  async getQuoteWithDeposit(
    params: IntentsQuoteParams,
  ): Promise<NearIntentsQuoteResponse> {
    try {
      const response = await this.httpClient.post('/v0/quote', {
        ...params,
        dry: false,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to get quote with deposit from NEAR Intents: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Get status of a deposit by deposit address
   */
  async getStatus(depositAddress: string): Promise<NearIntentsStatusResponse> {
    try {
      const response = await this.httpClient.get('/v0/status', {
        params: {
          depositAddress,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to get status from NEAR Intents: ${error.message}`,
        );
      }
      throw error;
    }
  }
}

