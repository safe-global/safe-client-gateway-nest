import { faker } from '@faker-js/faker';
import type { ILoggingService } from '@/logging/logging.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import type { RedisClientType } from 'redis';
import { fakeJson } from '@/__tests__/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import clearAllMocks = jest.clearAllMocks;
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { MAX_TTL } from '@/datasources/cache/constants';

const mockLoggingService: jest.MockedObjectDeep<ILoggingService> = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

describe('RedisCacheService', () => {
  let redisCacheService: RedisCacheService;
  let defaultExpirationTimeInSeconds: number;
  const keyPrefix = '';
  let redisClient: RedisClientType;

  beforeAll(async () => {
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    clearAllMocks();
    await redisClient.flushDb();
    defaultExpirationTimeInSeconds = faker.number.int({ min: 1, max: 3600 });
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') {
        return defaultExpirationTimeInSeconds;
      } else if (key === 'redis.timeout') {
        return defaultExpirationTimeInSeconds * 1_000;
      }
      throw Error(`Unexpected key: ${key}`);
    });

    redisCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      mockConfigurationService,
      keyPrefix,
    );
  });

  it('Setting key without setting expireTimeSeconds does not store the value', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();

    await redisCacheService.hSet(cacheDir, value, undefined);

    const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
    expect(storedValue).toBeNull();
  });

  it('Setting key with expireTimeSeconds does store the value with the provided TTL', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    const expireTime = faker.number.int();

    await redisCacheService.hSet(cacheDir, value, expireTime);

    const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
    const ttl = await redisClient.ttl(cacheDir.key);
    expect(storedValue).toEqual(value);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(expireTime);
  });

  it('Setting key throws on expire', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );

    // Expiration time out of range to force an error
    await expect(
      redisCacheService.hSet(cacheDir, '', Number.MAX_VALUE + 1),
    ).rejects.toThrow();

    const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
    expect(storedValue).toBeNull();
  });

  it('Getting key gets the stored value', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    await redisClient.hSet(cacheDir.key, cacheDir.field, value);

    const storedValue = await redisCacheService.hGet(cacheDir);

    expect(storedValue).toEqual(value);
  });

  it('Deleting key deletes the stored value and sets invalidationTime', async () => {
    const startTime = Date.now();
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    await redisClient.hSet(cacheDir.key, cacheDir.field, value);

    await redisCacheService.deleteByKey(cacheDir.key);

    const storedValue = await redisClient.hGet(cacheDir.key, cacheDir.field);
    const invalidationTime = Number(
      await redisClient.hGet(`invalidationTimeMs:${cacheDir.key}`, ''),
    );
    const invalidationTimeTtl = await redisClient.ttl(
      `invalidationTimeMs:${cacheDir.key}`,
    );
    expect(storedValue).toBeNull();
    expect(invalidationTime).toBeGreaterThanOrEqual(startTime);
    expect(invalidationTimeTtl).toBeGreaterThan(0);
    expect(invalidationTimeTtl).toBeLessThanOrEqual(
      defaultExpirationTimeInSeconds,
    );
  });

  it('When Module gets destroyed, redis connection is closed', async () => {
    await redisCacheService.onModuleDestroy();

    // Connection is closed, this is expected to throw an error
    await expect(redisCacheService.ping()).rejects.toThrow();
    // Connection is reopened after this test execution
    redisClient = await redisClientFactory();
  });

  it('creates a missing key and increments its value', async () => {
    const expireTime = faker.number.int({ min: 1 });
    const key = faker.string.alphanumeric();

    const firstResult = await redisCacheService.increment(key, expireTime);

    const ttl = await redisClient.ttl(key);
    expect(firstResult).toEqual(1);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(expireTime);
  });

  it('increments the value of an existing key', async () => {
    const expireTime = faker.number.int({ min: 1 });
    const key = faker.string.alphanumeric();
    const initialValue = faker.number.int({ min: 100 });
    await redisClient.set(key, initialValue, { EX: expireTime });

    for (let i = 1; i <= 5; i++) {
      const result = await redisCacheService.increment(key, undefined);
      expect(result).toEqual(initialValue + i);
    }

    const ttl = await redisClient.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(expireTime);
  });

  it('sets and gets the value of a counter key', async () => {
    const key = faker.string.alphanumeric();
    const value = faker.number.int({ min: 100 });
    await redisCacheService.setCounter(key, value, MAX_TTL);

    const result = await redisCacheService.getCounter(key);
    expect(result).toEqual(value);
  });

  it('sets and gets the value of a zero-value counter', async () => {
    const key = faker.string.alphanumeric();
    await redisCacheService.setCounter(key, 0, MAX_TTL);

    const result = await redisCacheService.getCounter(key);
    expect(result).toEqual(0);

    await redisCacheService.increment(key, undefined);
    await redisCacheService.increment(key, undefined);
    await redisCacheService.increment(key, undefined);

    const result2 = await redisCacheService.getCounter(key);
    expect(result2).toEqual(3);
  });

  it('increments and gets the value of an existing non-zero counter', async () => {
    const key = faker.string.alphanumeric();
    const value = faker.number.int({ min: 100 });
    await redisCacheService.setCounter(key, value, MAX_TTL);

    await redisCacheService.increment(key, undefined);
    await redisCacheService.increment(key, undefined);
    await redisCacheService.increment(key, undefined);

    const result = await redisCacheService.getCounter(key);
    expect(result).toEqual(value + 3);
  });

  it('returns null for a non-numeric counter value', async () => {
    const key = faker.string.alphanumeric();
    await redisClient.set(key, faker.string.sample());

    const result = await redisCacheService.getCounter(key);
    expect(result).toBeNull();
  });

  it('stores a key for MAX_TTL seconds', async () => {
    const key = faker.string.alphanumeric();
    const value = faker.string.sample();

    try {
      await redisCacheService.hSet(new CacheDir(key, ''), value, MAX_TTL);
    } catch (err) {
      console.error(err);
      throw new Error('Should not throw');
    }

    const storedValue = await redisClient.hGet(key, '');
    const ttl = await redisClient.ttl(key);
    expect(storedValue).toEqual(value);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});
