/**
 * NEAR Intents token IDs configuration
 * 
 * NOTE: These IDs must match the 'id' field returned by the specific Intents Provider API (e.g. /v0/tokens).
 * If the provider changes their ID schema (e.g. 'usdc-ethereum-mainnet' -> 'eth-usdc'), this config must be updated.
 * 
 * TODO: In production, consider fetching these dynamically at startup and caching them, 
 *       falling back to these hardcoded values only if the API is unreachable.
 */
export const INTENTS_TOKEN_IDS = {
  // ZEC (Zcash)
  ZEC: { id: 'zec-mainnet', decimals: 8 },
  
  // USDC on Ethereum
  USDC_ETHEREUM: { id: 'usdc-ethereum-mainnet', decimals: 6 },
  
  // USDC on other chains
  USDC_POLYGON: { id: 'usdc-polygon-mainnet', decimals: 6 },
  USDC_ARBITRUM: { id: 'usdc-arbitrum-mainnet', decimals: 6 },
  USDC_OPTIMISM: { id: 'usdc-optimism-mainnet', decimals: 6 },
  USDC_BASE: { id: 'usdc-base-mainnet', decimals: 6 },
} as const;

/**
 * Get token info for a given asset and chain
 */
export function getIntentsTokenInfo(asset: string, chain: string) {
  // Normalize inputs: uppercase asset, uppercase chain, remove '-mainnet' suffix if present
  const normalizedAsset = asset.toUpperCase();
  let normalizedChain = chain.toUpperCase();
  
  if (normalizedChain.endsWith('-MAINNET')) {
    normalizedChain = normalizedChain.replace('-MAINNET', '');
  }
  
  const key = `${normalizedAsset}_${normalizedChain}`;
  const tokenInfo = INTENTS_TOKEN_IDS[key as keyof typeof INTENTS_TOKEN_IDS];
  
  if (!tokenInfo) {
    // Fallback or Error
    // For MVP, we throw. In future, we could try to construct the ID dynamically (e.g. `${asset.toLowerCase()}-${chain.toLowerCase()}-mainnet`)
    throw new Error(`Token info not found for ${asset} on ${chain}. Key: ${key}. Please add it to INTENTS_TOKEN_IDS config.`);
  }
  
  return tokenInfo;
}
