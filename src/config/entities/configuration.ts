import { randomBytes } from 'crypto';

// Custom configuration for the application

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  accounts: {
    creationRateLimitPeriodSeconds: parseInt(
      process.env.ACCOUNT_CREATION_RATE_LIMIT_PERIOD_SECONDS ?? `${3600}`,
    ),
    creationRateLimitCalls: parseInt(
      process.env.ACCOUNT_CREATION_RATE_LIMIT_CALLS_BY_PERIOD ?? `${25}`,
    ),
    counterfactualSafes: {
      creationRateLimitPeriodSeconds: parseInt(
        process.env.COUNTERFACTUAL_SAFES_CREATION_RATE_LIMIT_PERIOD_SECONDS ??
          `${3600}`,
      ),
      creationRateLimitCalls: parseInt(
        process.env.COUNTERFACTUAL_SAFES_CREATION_RATE_LIMIT_CALLS_BY_PERIOD ??
          `${25}`,
      ),
    },
    encryption: {
      // The encryption type to use. Defaults to 'local'.
      // Supported values: 'aws', 'local'
      type: process.env.ACCOUNTS_ENCRYPTION_TYPE || 'local',
      awsKms: {
        keyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID,
        algorithm: process.env.AWS_KMS_ENCRYPTION_ALGORITHM || 'aes-256-cbc',
      },
      local: {
        algorithm: process.env.LOCAL_ENCRYPTION_ALGORITHM || 'aes-256-cbc',
        key:
          process.env.LOCAL_ENCRYPTION_KEY || randomBytes(32).toString('hex'),
        iv: process.env.LOCAL_ENCRYPTION_IV || randomBytes(16).toString('hex'),
      },
    },
  },
  amqp: {
    url: process.env.AMQP_URL || 'amqp://localhost:5672',
    exchange: {
      name: process.env.AMQP_EXCHANGE_NAME || 'safe-transaction-service-events',
      // The Safe Transaction Service AMQP Exchange mode defaults to 'fanout'.
      // https://www.rabbitmq.com/tutorials/amqp-concepts#exchange-fanout
      // A fanout exchange routes messages to all of the queues that are bound to it and the routing key is ignored.
      mode: process.env.AMQP_EXCHANGE_MODE || 'fanout',
    },
    queue: process.env.AMQP_QUEUE || 'safe-client-gateway',
    // The AMQP Prefetch value defaults to 0.
    // Limits the number of unacknowledged messages delivered to a given channel/consumer.
    prefetch:
      process.env.AMQP_PREFETCH != null
        ? parseInt(process.env.AMQP_PREFETCH)
        : 100,
  },
  application: {
    isProduction: process.env.CGW_ENV === 'production',
    // Enables/disables the execution of migrations on startup.
    // Defaults to true.
    runMigrations: process.env.RUN_MIGRATIONS?.toLowerCase() !== 'false',
    port: process.env.APPLICATION_PORT || '3000',
  },
  auth: {
    token: process.env.AUTH_TOKEN,
    nonceTtlSeconds: parseInt(
      process.env.AUTH_NONCE_TTL_SECONDS ?? `${5 * 60}`,
    ),
    maxValidityPeriodSeconds: parseInt(
      process.env.AUTH_VALIDITY_PERIOD_SECONDS ?? `${24 * 60 * 60}`, // 24 hours
    ),
  },
  balances: {
    providers: {
      safe: {
        prices: {
          baseUri:
            process.env.PRICES_PROVIDER_API_BASE_URI ||
            'https://api.coingecko.com/api/v3',
          apiKey: process.env.PRICES_PROVIDER_API_KEY,
          pricesTtlSeconds: parseInt(
            process.env.PRICES_TTL_SECONDS ?? `${300}`,
          ),
          nativeCoinPricesTtlSeconds: parseInt(
            process.env.NATIVE_COINS_PRICES_TTL_SECONDS ?? `${100}`,
          ),
          notFoundPriceTtlSeconds: parseInt(
            process.env.NOT_FOUND_PRICE_TTL_SECONDS ?? `${72 * 60 * 60}`,
          ),
          highRefreshRateTokens:
            process.env.HIGH_REFRESH_RATE_TOKENS?.split(',') ?? [],
          highRefreshRateTokensTtlSeconds: parseInt(
            process.env.HIGH_REFRESH_RATE_TOKENS_TTL_SECONDS ?? `${30}`,
          ),
        },
      },
      zerion: {
        apiKey: process.env.ZERION_API_KEY,
        baseUri: process.env.ZERION_BASE_URI || 'https://api.zerion.io',
        chains: {
          1: { chainName: 'ethereum' },
          10: { chainName: 'optimism' },
          100: { chainName: 'xdai' },
          1101: { chainName: 'polygon-zkevm' },
          1313161554: { chainName: 'aurora' },
          137: { chainName: 'polygon' },
          324: { chainName: 'zksync-era' },
          42161: { chainName: 'arbitrum' },
          42220: { chainName: 'celo' },
          43114: { chainName: 'avalanche' },
          534352: { chainName: 'scroll' },
          56: { chainName: 'binance-smart-chain' },
          8453: { chainName: 'base' },
        },
        currencies: [
          'usd',
          'eur',
          'eth',
          'aud',
          'btc',
          'cad',
          'chf',
          'cny',
          'gbp',
          'inr',
          'jpy',
          'krw',
          'nzd',
          'rub',
          'try',
          'zar',
        ],
        limitPeriodSeconds: parseInt(
          process.env.ZERION_RATE_LIMIT_PERIOD_SECONDS ?? `${10}`,
        ),
        limitCalls: parseInt(
          process.env.ZERION_RATE_LIMIT_CALLS_BY_PERIOD ?? `${2}`,
        ),
      },
    },
  },
  blockchain: {
    infura: {
      apiKey: process.env.INFURA_API_KEY,
    },
  },
  db: {
    migrator: {
      // Determines if database migrations should be executed. By default, it will execute
      executeMigrations:
        process.env.DB_MIGRATIONS_EXECUTE?.toLowerCase() !== 'false',
      // The number of times to retry running migrations in case of failure. Defaults to 5 retries.
      numberOfRetries: process.env.DB_MIGRATIONS_NUMBER_OF_RETRIES ?? 5,
      // The time interval (in milliseconds) to wait before retrying a failed migration. Defaults to 1000ms (1 second).
      retryAfterMs: process.env.DB_MIGRATIONS_RETRY_AFTER_MS ?? 1000, // Milliseconds
    },
    orm: {
      // Indicates if migrations should be automatically run when the ORM initializes. Set to false to control this behavior manually.
      migrationsRun: false,
      // Enables the automatic loading of entities into the ORM.
      autoLoadEntities: true,
      // Requires manual initialization of the database connection. Useful for controlling startup behavior.
      manualInitialization: true,
      // The name of the table where migrations are stored. Uses the environment variable value or defaults to '_migrations'.
      migrationsTableName:
        process.env.ORM_MIGRATION_TABLE_NAME || '_migrations',
    },
    connection: {
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || '5432',
        database: process.env.POSTGRES_DB || 'safe-client-gateway',
        schema: process.env.POSTGRES_SCHEMA || 'main', //@TODO: use this schema
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        ssl: {
          enabled: process.env.POSTGRES_SSL_ENABLED?.toLowerCase() === 'true',
          requestCert:
            process.env.POSTGRES_SSL_REQUEST_CERT?.toLowerCase() !== 'false',
          // If the value is not explicitly set to false, default should be true
          // If not false the server will reject any connection which is not authorized with the list of supplied CAs
          // https://nodejs.org/docs/latest-v20.x/api/tls.html#tlscreateserveroptions-secureconnectionlistener
          rejectUnauthorized:
            process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED?.toLowerCase() !==
            'false',
          caPath: process.env.POSTGRES_SSL_CA_PATH,
        },
      },
    },
  },
  email: {
    applicationCode: process.env.EMAIL_API_APPLICATION_CODE,
    baseUri: process.env.EMAIL_API_BASE_URI || 'https://api.pushwoosh.com',
    apiKey: process.env.EMAIL_API_KEY,
    fromEmail: process.env.EMAIL_API_FROM_EMAIL,
    fromName: process.env.EMAIL_API_FROM_NAME || 'Safe',
  },
  expirationTimeInSeconds: {
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
    rpc: parseInt(process.env.EXPIRATION_TIME_RPC_SECONDS ?? `${15}`),
    holesky: parseInt(process.env.HOLESKY_EXPIRATION_TIME_SECONDS ?? `${60}`),
    indexing: parseInt(process.env.EXPIRATION_TIME_INDEXING_SECONDS ?? `${5}`),
    staking: parseInt(process.env.EXPIRATION_TIME_STAKING_SECONDS ?? `${60}`),
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
    email: process.env.FF_EMAIL?.toLowerCase() === 'true',
    zerionBalancesChainIds:
      process.env.FF_ZERION_BALANCES_CHAIN_IDS?.split(',') ?? [],
    debugLogs: process.env.FF_DEBUG_LOGS?.toLowerCase() === 'true',
    configHooksDebugLogs:
      process.env.FF_CONFIG_HOOKS_DEBUG_LOGS?.toLowerCase() === 'true',
    auth: process.env.FF_AUTH?.toLowerCase() === 'true',
    delegatesV2: process.env.FF_DELEGATES_V2?.toLowerCase() === 'true',
    counterfactualBalances:
      process.env.FF_COUNTERFACTUAL_BALANCES?.toLowerCase() === 'true',
    accounts: process.env.FF_ACCOUNTS?.toLowerCase() === 'true',
    users: process.env.FF_USERS?.toLowerCase() === 'true',
    // TODO: When enabled, we must add `db` as a requirement alongside `redis`
    pushNotifications:
      process.env.FF_PUSH_NOTIFICATIONS?.toLowerCase() === 'true',
    hookHttpPostEvent:
      process.env.FF_HOOK_HTTP_POST_EVENT?.toLowerCase() === 'true',
    improvedAddressPoisoning:
      process.env.FF_IMPROVED_ADDRESS_POISONING?.toLowerCase() === 'true',
  },
  httpClient: {
    // Timeout in milliseconds to be used for the HTTP client.
    // A value of 0 disables the timeout.
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
  jwt: {
    issuer: process.env.JWT_ISSUER,
    secret: process.env.JWT_SECRET,
  },
  locking: {
    baseUri:
      process.env.LOCKING_PROVIDER_API_BASE_URI ||
      'https://safe-locking.safe.global',
    eligibility: {
      fingerprintEncryptionKey: process.env.FINGERPRINT_ENCRYPTION_KEY,
      nonEligibleCountryCodes:
        process.env.FINGERPRINT_NON_ELIGIBLE_COUNTRY_CODES?.split(',') ?? [
          'US',
        ],
    },
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
    prettyColorize: process.env.LOG_PRETTY_COLORIZE?.toLowerCase() === 'true',
  },
  owners: {
    // There is no hook to invalidate the owners, so defaulting 0 disables the cache
    ownersTtlSeconds: parseInt(process.env.OWNERS_TTL_SECONDS ?? `${0}`),
  },
  mappings: {
    imitation: {
      lookupDistance: parseInt(process.env.IMITATION_LOOKUP_DISTANCE ?? `${3}`),
      prefixLength: parseInt(process.env.IMITATION_PREFIX_LENGTH ?? `${3}`),
      suffixLength: parseInt(process.env.IMITATION_SUFFIX_LENGTH ?? `${4}`),
      // Note: due to high value formatted token values, we use bigint
      // This means the value tolerance can only be an integer
      valueTolerance: BigInt(process.env.IMITATION_VALUE_TOLERANCE ?? 1),
      echoLimit: BigInt(process.env.IMITATION_ECHO_LIMIT ?? `${10}`),
    },
    history: {
      maxNestedTransfers: parseInt(
        process.env.MAX_NESTED_TRANSFERS ?? `${100}`,
      ),
    },
    safe: {
      maxOverviews: parseInt(process.env.MAX_SAFE_OVERVIEWS ?? `${10}`),
    },
  },
  portfolio: {
    baseUri:
      process.env.PORTFOLIO_API_BASE_URI || 'https://octav-api.hasura.app',
    apiKey: process.env.PORTFOLIO_API_KEY || 'TODO',
  },
  pushNotifications: {
    baseUri:
      process.env.PUSH_NOTIFICATIONS_API_BASE_URI ||
      'https://fcm.googleapis.com/v1/projects',
    project: process.env.PUSH_NOTIFICATIONS_API_PROJECT,
    serviceAccount: {
      clientEmail:
        process.env.PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL,
      privateKey:
        process.env.PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
  },
  redis: {
    user: process.env.REDIS_USER,
    pass: process.env.REDIS_PASS,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    timeout: process.env.REDIS_TIMEOUT || 2 * 1_000, // Milliseconds
    disableOfflineQueue:
      process.env.REDIS_DISABLE_OFFLINE_QUEUE?.toString() === 'true',
  },
  relay: {
    baseUri:
      process.env.RELAY_PROVIDER_API_BASE_URI || 'https://api.gelato.digital',
    limit: parseInt(process.env.RELAY_THROTTLE_LIMIT ?? `${5}`),
    ttlSeconds: parseInt(
      process.env.RELAY_THROTTLE_TTL_SECONDS ?? `${60 * 60 * 24}`,
    ),
    apiKey: {
      // Optimism
      10: process.env.RELAY_PROVIDER_API_KEY_OPTIMISM,
      // BNB
      56: process.env.RELAY_PROVIDER_API_KEY_BSC,
      // Gnosis
      100: process.env.RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN,
      // Polygon
      137: process.env.RELAY_PROVIDER_API_KEY_POLYGON,
      // Polygon zkEVM
      1101: process.env.RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM,
      // Base
      8453: process.env.RELAY_PROVIDER_API_KEY_BASE,
      // Arbitrum
      42161: process.env.RELAY_PROVIDER_API_KEY_ARBITRUM_ONE,
      // Avalanche
      43114: process.env.RELAY_PROVIDER_API_KEY_AVALANCHE,
      // Linea
      59144: process.env.RELAY_PROVIDER_API_KEY_LINEA,
      // Blast
      81457: process.env.RELAY_PROVIDER_API_KEY_BLAST,
      // Sepolia
      11155111: process.env.RELAY_PROVIDER_API_KEY_SEPOLIA,
    },
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
    chains: {
      maxSequentialPages: parseInt(
        process.env.SAFE_CONFIG_CHAINS_MAX_SEQUENTIAL_PAGES ?? `${3}`,
      ),
    },
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
  safeWebApp: {
    baseUri: process.env.SAFE_WEB_APP_BASE_URI || 'https://app.safe.global',
  },
  staking: {
    testnet: {
      baseUri:
        process.env.STAKING_TESTNET_API_BASE_URI ||
        'https://api.testnet.kiln.fi',
      apiKey: process.env.STAKING_TESTNET_API_KEY,
    },
    mainnet: {
      baseUri: process.env.STAKING_API_BASE_URI || 'https://api.kiln.fi',
      apiKey: process.env.STAKING_API_KEY,
    },
  },
  swaps: {
    api: {
      1: 'https://api.cow.fi/mainnet',
      100: 'https://api.cow.fi/xdai',
      8453: 'https://api.cow.fi/base',
      42161: 'https://api.cow.fi/arbitrum_one',
      11155111: 'https://api.cow.fi/sepolia',
    },
    explorerBaseUri:
      process.env.SWAPS_EXPLORER_URI || 'https://explorer.cow.fi/',
    // If set to true, it will restrict the Swap Feature to be used only
    // with Apps contained in allowedApps
    restrictApps: process.env.SWAPS_RESTRICT_APPS?.toLowerCase() === 'true',
    // The comma-separated collection of allowed CoW Swap Apps.
    // In order for this collection to take effect, restrictApps should be set to true
    // The app names should match the "App Code" of the metadata provided to CoW Swap.
    // See https://explorer.cow.fi/appdata?tab=encode
    allowedApps: process.env.SWAPS_ALLOWED_APPS?.split(',') || [],
    // Upper limit of parts we will request from CoW for TWAP orders, after
    // which we return base values for those orders
    // Note: 11 is the average number of parts, confirmed by CoW
    maxNumberOfParts: parseInt(
      process.env.SWAPS_MAX_NUMBER_OF_PARTS ?? `${11}`,
    ),
  },
  targetedMessaging: {
    fileStorage: {
      // The type of file storage to use. Defaults to 'local'.
      // Supported values: 'aws', 'local'
      type: process.env.TARGETED_MESSAGING_FILE_STORAGE_TYPE || 'local',
      aws: {
        // This will be ignored if the TARGETED_MESSAGING_FILE_STORAGE_TYPE is set to 'local'.
        // For reference, these environment variables should be present in the environment,
        // but they are not transferred to the memory/configuration file:
        // AWS_ACCESS_KEY_ID
        // AWS_SECRET_ACCESS_KEY
        // AWS_REGION
        bucketName:
          process.env.AWS_STORAGE_BUCKET_NAME || 'safe-client-gateway',
        basePath: process.env.AWS_S3_BASE_PATH || 'assets/targeted-messaging',
      },
      local: {
        // This will be ignored if the TARGETED_MESSAGING_FILE_STORAGE_TYPE is set to 'aws'.
        baseDir:
          process.env.TARGETED_MESSAGING_LOCAL_BASE_DIR ||
          'assets/targeted-messaging',
      },
    },
  },
});
