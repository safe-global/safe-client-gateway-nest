import { faker } from '@faker-js/faker';
import type configuration from '@/config/entities/configuration';

export default (): ReturnType<typeof configuration> => ({
  about: {
    name: faker.word.words(),
    version: faker.system.semver(),
    buildNumber: faker.string.numeric(),
  },
  accounts: {
    creationRateLimitPeriodSeconds: faker.number.int(),
    creationRateLimitCalls: faker.number.int(),
    counterfactualSafes: {
      creationRateLimitPeriodSeconds: faker.number.int(),
      creationRateLimitCalls: faker.number.int(),
    },
    encryption: {
      type: faker.string.sample(),
      awsKms: {
        algorithm: faker.string.alphanumeric(),
        keyId: faker.string.uuid(),
      },
      local: {
        algorithm: faker.string.alphanumeric(),
        key: faker.string.alphanumeric(),
        iv: faker.string.alphanumeric(),
      },
    },
  },
  amqp: {
    url: faker.internet.url({ appendSlash: false }),
    exchange: { name: faker.string.sample(), mode: faker.string.sample() },
    queue: faker.string.sample(),
    prefetch: faker.number.int(),
  },
  application: {
    isProduction: faker.datatype.boolean(),
    runMigrations: true,
    port: faker.internet.port().toString(),
  },
  auth: {
    token: faker.string.hexadecimal({ length: 32 }),
    nonceTtlSeconds: faker.number.int(),
    maxValidityPeriodSeconds: faker.number.int({ min: 1, max: 60 * 1_000 }),
  },
  balances: {
    providers: {
      safe: {
        prices: {
          baseUri: faker.internet.url({ appendSlash: false }),
          apiKey: faker.string.hexadecimal({ length: 32 }),
          pricesTtlSeconds: faker.number.int(),
          nativeCoinPricesTtlSeconds: faker.number.int(),
          notFoundPriceTtlSeconds: faker.number.int(),
          highRefreshRateTokens: [],
          highRefreshRateTokensTtlSeconds: faker.number.int(),
        },
      },
      zerion: {
        apiKey: faker.string.hexadecimal({ length: 32 }),
        baseUri: faker.internet.url({ appendSlash: false }),
        chains: {
          1: { chainName: faker.string.sample() },
          10: { chainName: faker.string.sample() },
          100: { chainName: faker.string.sample() },
          1101: { chainName: faker.string.sample() },
          1313161554: { chainName: faker.string.sample() },
          137: { chainName: faker.string.sample() },
          324: { chainName: faker.string.sample() },
          42161: { chainName: faker.string.sample() },
          42220: { chainName: faker.string.sample() },
          43114: { chainName: faker.string.sample() },
          534352: { chainName: faker.string.sample() },
          56: { chainName: faker.string.sample() },
          8453: { chainName: faker.string.sample() },
        },
        currencies: Array.from(
          new Set([
            ...Array.from(
              { length: faker.number.int({ min: 2, max: 5 }) },
              () => faker.finance.currencyCode().toLowerCase(),
            ),
            'btc',
            'eth',
            'eur',
            'usd',
          ]),
        ),
        limitPeriodSeconds: faker.number.int({ min: 1, max: 10 }),
        limitCalls: faker.number.int({ min: 1, max: 5 }),
      },
    },
  },
  blockchain: {
    infura: {
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
  },
  db: {
    migrator: {
      executeMigrations: true,
      numberOfRetries: process.env.DB_TEST_MIGRATIONS_NUMBER_OF_RETRIES ?? 5,
      retryAfterMs: process.env.DB_TEST_MIGRATIONS_RETRY_AFTER_MS ?? 1000, // Milliseconds
    },
    orm: {
      autoLoadEntities: true,
      manualInitialization: true,
      migrationsRun: false,
      migrationsTableName: '_migrations',
    },
    connection: {
      postgres: {
        schema: process.env.POSTGRES_SCHEMA || 'main',
        host: process.env.POSTGRES_TEST_HOST || 'localhost',
        port: process.env.POSTGRES_TEST_PORT || '5433',
        database: process.env.POSTGRES_TEST_DB || 'test-db',
        username: process.env.POSTGRES_TEST_USER || 'postgres',
        password: process.env.POSTGRES_TEST_PASSWORD || 'postgres',
        ssl: {
          enabled: true,
          requestCert: true,
          rejectUnauthorized: true,
          caPath:
            process.env.POSTGRES_SSL_CA_PATH || 'db_config/test/server.crt',
        },
      },
    },
  },
  email: {
    applicationCode: faker.string.alphanumeric(),
    baseUri: faker.internet.url({ appendSlash: false }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
    fromEmail: faker.internet.email(),
    fromName: faker.person.fullName(),
  },
  expirationTimeInSeconds: {
    default: faker.number.int(),
    rpc: faker.number.int(),
    holesky: faker.number.int(),
    indexing: faker.number.int(),
    staking: faker.number.int(),
    notFound: {
      default: faker.number.int(),
      contract: faker.number.int(),
      token: faker.number.int(),
    },
  },
  express: { jsonLimit: '1mb' },
  features: {
    email: false,
    zerionBalancesChainIds: ['137'],
    debugLogs: false,
    configHooksDebugLogs: false,
    auth: false,
    delegatesV2: false,
    counterfactualBalances: false,
    accounts: false,
    users: false,
    pushNotifications: false,
    hookHttpPostEvent: false,
    improvedAddressPoisoning: false,
  },
  httpClient: { requestTimeout: faker.number.int() },
  locking: {
    baseUri: faker.internet.url({ appendSlash: false }),
    eligibility: {
      fingerprintEncryptionKey: faker.string.uuid(),
      nonEligibleCountryCodes: faker.helpers.multiple(
        () => faker.location.countryCode(),
        { count: { min: 1, max: 5 } },
      ),
    },
  },
  jwt: {
    issuer: process.env.JWT_TEST_ISSUER || 'dummy-issuer',
    secret: process.env.JWT_TEST_SECRET || 'dummy-secret',
  },
  log: {
    level: 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
    prettyColorize: process.env.LOG_PRETTY_COLORIZE?.toLowerCase() === 'true',
  },
  mappings: {
    imitation: {
      lookupDistance: faker.number.int(),
      prefixLength: faker.number.int(),
      suffixLength: faker.number.int(),
      valueTolerance: faker.number.bigInt(),
      echoLimit: faker.number.bigInt(),
    },
    history: {
      maxNestedTransfers: faker.number.int({ min: 1, max: 5 }),
    },
    safe: {
      maxOverviews: faker.number.int({ min: 1, max: 5 }),
    },
  },
  owners: {
    ownersTtlSeconds: faker.number.int(),
  },
  portfolio: {
    baseUri: faker.internet.url({ appendSlash: false }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
  },
  pushNotifications: {
    baseUri: faker.internet.url({ appendSlash: false }),
    project: faker.word.noun(),
    serviceAccount: {
      clientEmail: faker.internet.email(),
      privateKey: faker.string.alphanumeric(),
    },
  },
  redis: {
    user: process.env.REDIS_USER,
    pass: process.env.REDIS_PASS,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    timeout: process.env.REDIS_TIMEOUT || 1 * 1_000, // Milliseconds
    disableOfflineQueue:
      process.env.REDIS_DISABLE_OFFLINE_QUEUE?.toString() === 'true',
  },
  relay: {
    baseUri: faker.internet.url({ appendSlash: false }),
    limit: faker.number.int({ min: 1 }),
    ttlSeconds: faker.number.int(),
    apiKey: {
      10: faker.string.hexadecimal({ length: 32 }),
      56: faker.string.hexadecimal({ length: 32 }),
      100: faker.string.hexadecimal({ length: 32 }),
      137: faker.string.hexadecimal({ length: 32 }),
      1101: faker.string.hexadecimal({ length: 32 }),
      8453: faker.string.hexadecimal({ length: 32 }),
      42161: faker.string.hexadecimal({ length: 32 }),
      43114: faker.string.hexadecimal({ length: 32 }),
      59144: faker.string.hexadecimal({ length: 32 }),
      81457: faker.string.hexadecimal({ length: 32 }),
      11155111: faker.string.hexadecimal({ length: 32 }),
    },
  },
  safeConfig: {
    baseUri: faker.internet.url({ appendSlash: false }),
    chains: {
      maxSequentialPages: faker.number.int(),
    },
  },
  safeTransaction: {
    useVpcUrl: false,
  },
  safeWebApp: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  staking: {
    testnet: {
      baseUri: faker.internet.url({ appendSlash: false }),
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
    mainnet: {
      baseUri: faker.internet.url({ appendSlash: false }),
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
  },
  swaps: {
    api: {
      1: faker.internet.url({ appendSlash: false }),
      100: faker.internet.url({ appendSlash: false }),
      8453: faker.internet.url({ appendSlash: false }),
      42161: faker.internet.url({ appendSlash: false }),
      11155111: faker.internet.url({ appendSlash: false }),
    },
    explorerBaseUri: faker.internet.url({ appendSlash: true }),
    restrictApps: false,
    allowedApps: [],
    maxNumberOfParts: faker.number.int(),
  },
  targetedMessaging: {
    fileStorage: {
      type: 'local',
      aws: {
        bucketName: faker.string.alphanumeric(),
        basePath: faker.system.directoryPath(),
      },
      local: {
        baseDir: 'assets/targeted-messaging',
      },
    },
  },
});
