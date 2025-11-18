export interface NearIntentsConfig {
  baseUrl: string;
  jwtToken?: string;
}

export const getNearIntentsConfig = (): NearIntentsConfig => {
  return {
    baseUrl: process.env.NEAR_INTENTS_BASE_URL || 'https://1click.chaindefuser.com',
    jwtToken: process.env.NEAR_INTENTS_JWT || process.env.NEAR_INTENTS_API_KEY,
  };
};

