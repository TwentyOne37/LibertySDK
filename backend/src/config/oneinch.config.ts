export interface OneInchConfig {
  apiKey: string;
  baseUrl: string;
}

export function getOneInchConfig(): OneInchConfig {
  const apiKey = process.env.ONEINCH_API_KEY;
  if (!apiKey) {
    // Depending on strictness, we might want to throw or just warn. 
    // For Day 4, we'll assume it's needed for the feature.
    console.warn('ONEINCH_API_KEY is not set. 1inch integration will fail.');
  }

  return {
    apiKey: apiKey || '',
    baseUrl: process.env.ONEINCH_BASE_URL || 'https://api.1inch.dev/swap/v6.0',
  };
}

