import { Injectable } from '@nestjs/common';

export interface NearIntentsToken {
  address: string;
  symbol: string;
  decimals: number;
  chainId: string;
}

export interface NearIntentsQuote {
  depositAddress: string;
  amount: string;
  token: string;
  estimatedTime: number;
}

export interface NearIntentsQuoteWithDeposit extends NearIntentsQuote {
  depositAmount: string;
  depositToken: string;
}

export interface NearIntentsStatus {
  depositAddress: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

@Injectable()
export class NearIntentsClient {
  private readonly apiUrl: string;
  private readonly apiKey?: string;

  constructor() {
    this.apiUrl = process.env.NEAR_INTENTS_API_URL || 'https://api.near.org';
    this.apiKey = process.env.NEAR_INTENTS_API_KEY;
  }

  /**
   * Get available tokens for NEAR Intents
   */
  async getTokens(): Promise<NearIntentsToken[]> {
    // TODO: Implement actual API call
    throw new Error('Not implemented: getTokens');
  }

  /**
   * Get a quote for a payment intent (dry run, no deposit address)
   */
  async getQuoteDry(params: {
    amount: string;
    fromToken: string;
    toToken: string;
    toChain: string;
  }): Promise<NearIntentsQuote> {
    // TODO: Implement actual API call
    throw new Error('Not implemented: getQuoteDry');
  }

  /**
   * Get a quote with deposit address for a payment intent
   */
  async getQuoteWithDeposit(params: {
    amount: string;
    fromToken: string;
    toToken: string;
    toChain: string;
    merchantAddress: string;
  }): Promise<NearIntentsQuoteWithDeposit> {
    // TODO: Implement actual API call
    throw new Error('Not implemented: getQuoteWithDeposit');
  }

  /**
   * Get status of a deposit by deposit address
   */
  async getStatus(depositAddress: string): Promise<NearIntentsStatus> {
    // TODO: Implement actual API call
    throw new Error('Not implemented: getStatus');
  }
}

