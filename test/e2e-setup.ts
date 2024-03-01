process.env.SAFE_CONFIG_BASE_URI = 'https://safe-config.staging.5afe.dev';
process.env.EXPIRATION_TIME_DEFAULT_SECONDS = `${60}`; // long enough timeout for cache state assertions
process.env.FF_HUMAN_DESCRIPTION = 'true';
process.env.ALERTS_PROVIDER_SIGNING_KEY = 'fake-signing-key';
process.env.ALERTS_PROVIDER_API_KEY = 'fake-api-key';
process.env.ALERTS_PROVIDER_ACCOUNT = 'fake-account';
process.env.ALERTS_PROVIDER_PROJECT = 'fake-project';
process.env.EMAIL_API_APPLICATION_CODE = 'fake-application-code';
process.env.EMAIL_API_FROM_EMAIL = 'changeme@example.com';
process.env.EMAIL_API_KEY = 'fake-api-key';

// For E2E tests, connect to the test database
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5433';
process.env.POSTGRES_DB = 'test-db';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';

// For E2E tests, connect to the test cache
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
