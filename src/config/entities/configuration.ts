// Custom configuration for the application
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  alerts: {
    baseUri:
      process.env.ALERTS_PROVIDER_API_BASE_URI || 'https://api.tenderly.co',
    signingKey: process.env.ALERTS_PROVIDER_SIGNING_KEY,
    apiKey: process.env.ALERTS_PROVIDER_API_KEY,
    account: process.env.ALERTS_PROVIDER_ACCOUNT,
    project: process.env.ALERTS_PROVIDER_PROJECT,
  },
  applicationPort: process.env.APPLICATION_PORT || '3000',
  auth: {
    token: process.env.AUTH_TOKEN,
  },
  db: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || '5432',
      database: process.env.POSTGRES_DB || 'safe-client-gateway',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    },
  },
  email: {
    applicationCode: process.env.EMAIL_API_APPLICATION_CODE,
    baseUri: process.env.EMAIL_API_BASE_URI || 'https://api.pushwoosh.com',
    apiKey: process.env.EMAIL_API_KEY,
    fromEmail: process.env.EMAIL_API_FROM_EMAIL,
    fromName: process.env.EMAIL_API_FROM_NAME || 'Safe',
    templates: {
      recoveryTx: process.env.EMAIL_TEMPLATE_RECOVERY_TX,
      unknownRecoveryTx: process.env.EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX,
      verificationCode: process.env.EMAIL_TEMPLATE_VERIFICATION_CODE,
    },
    verificationCode: {
      resendLockWindowMs: parseInt(
        process.env.EMAIL_VERIFICATION_CODE_RESEND_LOCK_WINDOW_MS ??
          `${30 * 1000}`,
      ),
      ttlMs: parseInt(
        process.env.EMAIL_VERIFICATION_CODE_TTL_MS ?? `${5 * 60 * 1000}`,
      ),
    },
  },
  expirationTimeInSeconds: {
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
    notFound: {
      default: parseInt(
        process.env.DEFAULT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${30}`,
      ),
      contract: parseInt(
        process.env.CONTRACT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${60}`,
      ),
      token: parseInt(
        process.env.TOKEN_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${60}`,
      ),
    },
  },
  express: {
    // Controls the maximum request body size. If this is a number, then the value
    // specifies the number of bytes; if it is a string, the value is passed to the
    // bytes library for parsing. Defaults to '100kb'.
    // https://expressjs.com/en/resources/middleware/body-parser.html
    jsonLimit: process.env.EXPRESS_JSON_LIMIT ?? '1mb',
  },
  features: {
    richFragments: process.env.FF_RICH_FRAGMENTS?.toLowerCase() === 'true',
    email: process.env.FF_EMAIL?.toLowerCase() === 'true',
  },
  httpClient: {
    // Timeout in milliseconds to be used for the HTTP client.
    // A value of 0 disables the timeout.
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  mappings: {
    history: {
      maxNestedTransfers: parseInt(
        process.env.MAX_NESTED_TRANSFERS ?? `${100}`,
      ),
    },
  },
  prices: {
    baseUri:
      process.env.PRICES_PROVIDER_API_BASE_URI ||
      'https://api.coingecko.com/api/v3',
    apiKey: process.env.PRICES_PROVIDER_API_KEY,
    pricesTtlSeconds: parseInt(process.env.PRICES_TTL_SECONDS ?? `${300}`),
    notFoundPriceTtlSeconds: parseInt(
      process.env.NOT_FOUND_PRICE_TTL_SECONDS ?? `${72 * 60 * 60}`,
    ),
    chains: {
      1: { nativeCoin: 'ethereum', chainName: 'ethereum' },
      10: { nativeCoin: 'ethereum', chainName: 'optimistic-ethereum' },
      100: { nativeCoin: 'xdai', chainName: 'xdai' },
      1101: { nativeCoin: 'ethereum', chainName: 'polygon-zkevm' },
      11155111: { nativeCoin: 'ethereum', chainName: 'ethereum' },
      1313161554: { nativeCoin: 'ethereum', chainName: 'aurora' },
      137: { nativeCoin: 'matic-network', chainName: 'polygon-pos' },
      324: { nativeCoin: 'ethereum', chainName: 'zksync' },
      42161: { nativeCoin: 'ethereum', chainName: 'arbitrum-one' },
      42220: { nativeCoin: 'celo', chainName: 'celo' },
      43114: { nativeCoin: 'avalanche-2', chainName: 'avalanche' },
      5: { nativeCoin: 'ethereum', chainName: 'ethereum' },
      56: { nativeCoin: 'binancecoin', chainName: 'binance-smart-chain' },
      8453: { nativeCoin: 'ethereum', chainName: 'base' },
      84531: { nativeCoin: 'ethereum', chainName: 'base' },
      84532: { nativeCoin: 'ethereum', chainName: 'base' },
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  relay: {
    limit: parseInt(process.env.RELAY_THROTTLE_LIMIT ?? `${5}`),
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
  safeWebApp: {
    baseUri: process.env.SAFE_WEB_APP_BASE_URI || 'https://app.safe.global',
  },
});
