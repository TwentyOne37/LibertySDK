export interface IntentsQuoteParams {
  originAsset: string;
  destinationAsset: string;
  swapType: 'EXACT_OUTPUT' | 'EXACT_INPUT';
  amount: string;
  slippageTolerance?: number; // in basis points (bps)
  destinationAddress?: string;
}



