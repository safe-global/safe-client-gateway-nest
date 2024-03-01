import { faker } from '@faker-js/faker';
import configuration from '@/config/entities/configuration';

export default (): ReturnType<typeof configuration> => ({
  about: {
    name: faker.word.words(),
    version: faker.system.semver(),
    buildNumber: faker.string.numeric(),
  },
  alerts: {
    baseUri: faker.internet.url({ appendSlash: false }),
    signingKey: faker.string.nanoid(32),
    apiKey: faker.string.hexadecimal({ length: 32 }),
    account: faker.string.sample(),
    project: faker.string.sample(),
  },
  applicationPort: faker.internet.port().toString(),
  auth: {
    token: faker.string.hexadecimal({ length: 32 }),
  },
  db: {
    postgres: {
      host: process.env.POSTGRES_TEST_HOST || 'localhost',
      port: process.env.POSTGRES_TEST_PORT || '5433',
      database: process.env.POSTGRES_TEST_DB || 'test-db',
      username: process.env.POSTGRES_TEST_USER || 'postgres',
      password: process.env.POSTGRES_TEST_PASSWORD || 'postgres',
    },
  },
  email: {
    applicationCode: faker.string.alphanumeric(),
    baseUri: faker.internet.url({ appendSlash: true }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
    fromEmail: faker.internet.email(),
    fromName: faker.person.fullName(),
    templates: {
      recoveryTx: faker.string.alphanumeric(),
      unknownRecoveryTx: faker.string.alphanumeric(),
      verificationCode: faker.string.alphanumeric(),
    },
    verificationCode: {
      resendLockWindowMs: faker.number.int(),
      ttlMs: faker.number.int(),
    },
  },
  expirationTimeInSeconds: {
    default: faker.number.int(),
    notFound: {
      default: faker.number.int(),
      contract: faker.number.int(),
      token: faker.number.int(),
    },
  },
  express: { jsonLimit: '1mb' },
  features: {
    richFragments: true,
    email: true,
  },
  httpClient: { requestTimeout: faker.number.int() },
  log: {
    level: 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  mappings: {
    history: {
      maxNestedTransfers: faker.number.int({ min: 1, max: 5 }),
    },
  },
  prices: {
    baseUri: faker.internet.url({ appendSlash: false }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
    pricesTtlSeconds: faker.number.int(),
    notFoundPriceTtlSeconds: faker.number.int(),
    chains: {
      1: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      10: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      100: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      1101: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      11155111: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      1313161554: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      137: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      324: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      42161: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      42220: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      43114: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      5: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      56: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      8453: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      84531: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
      84532: {
        nativeCoin: faker.string.sample(),
        chainName: faker.string.sample(),
      },
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  relay: { limit: faker.number.int({ min: 1 }) },
  safeConfig: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  safeTransaction: {
    useVpcUrl: false,
  },
  safeWebApp: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
});
