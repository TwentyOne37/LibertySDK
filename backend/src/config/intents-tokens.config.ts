/**
 * NEAR Intents token IDs configuration
 * These can be looked up via getTokens() API and cached, but for now we hardcode common ones
 */
export const INTENTS_TOKEN_IDS = {
  // ZEC (Zcash) - this is a placeholder; replace with actual Intents token ID
  ZEC: 'zec-mainnet', // TODO: Replace with actual token ID from Intents API
  
  // USDC on Ethereum
  USDC_ETHEREUM: 'usdc-ethereum-mainnet', // TODO: Replace with actual token ID from Intents API
  
  // USDC on other chains (for future use)
  USDC_POLYGON: 'usdc-polygon-mainnet',
  USDC_ARBITRUM: 'usdc-arbitrum-mainnet',
} as const;

/**
 * Get token ID for a given asset and chain
 */
export function getIntentsTokenId(asset: string, chain: string): string {
  const key = `${asset.toUpperCase()}_${chain.toUpperCase()}`;
  const tokenId = INTENTS_TOKEN_IDS[key as keyof typeof INTENTS_TOKEN_IDS];
  
  if (!tokenId) {
    throw new Error(`Token ID not found for ${asset} on ${chain}. Please add it to INTENTS_TOKEN_IDS config.`);
  }
  
  return tokenId;
}

