/**
 * NEAR Intents token IDs configuration
 * These can be looked up via getTokens() API and cached, but for now we hardcode common ones
 * 
 * Structure: { id: string, decimals: number }
 */
export const INTENTS_TOKEN_IDS = {
  // ZEC (Zcash) - this is a placeholder; replace with actual Intents token ID
  ZEC: { id: 'zec-mainnet', decimals: 8 },
  
  // USDC on Ethereum
  USDC_ETHEREUM: { id: 'usdc-ethereum-mainnet', decimals: 6 },
  
  // USDC on other chains (for future use)
  USDC_POLYGON: { id: 'usdc-polygon-mainnet', decimals: 6 },
  USDC_ARBITRUM: { id: 'usdc-arbitrum-mainnet', decimals: 6 },
} as const;

/**
 * Get token info for a given asset and chain
 */
export function getIntentsTokenInfo(asset: string, chain: string) {
  // Normalize inputs: uppercase asset, uppercase chain, remove '-mainnet' suffix if present for matching
  const normalizedAsset = asset.toUpperCase();
  let normalizedChain = chain.toUpperCase();
  
  // Handle chain variations (e.g. "ethereum-mainnet" -> "ETHEREUM")
  if (normalizedChain.endsWith('-MAINNET')) {
    normalizedChain = normalizedChain.replace('-MAINNET', '');
  }
  
  const key = `${normalizedAsset}_${normalizedChain}`;
  const tokenInfo = INTENTS_TOKEN_IDS[key as keyof typeof INTENTS_TOKEN_IDS];
  
  if (!tokenInfo) {
    throw new Error(`Token info not found for ${asset} on ${chain}. Please add it to INTENTS_TOKEN_IDS config.`);
  }
  
  return tokenInfo;
}



