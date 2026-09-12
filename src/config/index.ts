export const config = {
  server: {
    port: parseInt(process.env.PORT || '3007', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: '2024-01',
  },
  amazon: {
    lwaClientId: process.env.AMAZON_LWA_CLIENT_ID || '',
    lwaClientSecret: process.env.AMAZON_LWA_CLIENT_SECRET || '',
    refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1AM78C64UM0Y8',
    sellerId: process.env.AMAZON_SELLER_ID || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
};
