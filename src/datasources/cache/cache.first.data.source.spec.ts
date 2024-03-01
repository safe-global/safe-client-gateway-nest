import { faker } from '@faker-js/faker';
import { fakeJson } from '@/__tests__/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

const networkService = {
  get: jest.fn(),
} as unknown as INetworkService;

const mockNetworkService = jest.mocked(networkService);

describe('CacheFirstDataSource', () => {
  let cacheFirstDataSource: CacheFirstDataSource;
  let fakeCacheService: FakeCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fakeCacheService = new FakeCacheService();
    cacheFirstDataSource = new CacheFirstDataSource(
      fakeCacheService,
      mockNetworkService,
      mockLoggingService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the data returned by the underlying network interface and cache it', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const data = JSON.parse(fakeJson());
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.resolve({ data, status: 200 });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    const actual = await cacheFirstDataSource.get({
      cacheDir,
      url: targetUrl,
      notFoundExpireTimeSeconds,
    });

    expect(actual).toEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(1); // only data is cached (as no invalidation happened yet at this point in time)
    await expect(fakeCacheService.get(cacheDir)).resolves.toEqual(
      JSON.stringify(data),
    );
  });

  it('should return the network data and it should cache it if the last invalidation happened before the request was initiated', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const data = JSON.parse(fakeJson());
    const invalidationTimeMs = jest.now(); // invalidation happens at this point in time
    await fakeCacheService.set(
      new CacheDir(`invalidationTimeMs:${cacheDir.key}`, ''),
      invalidationTimeMs.toString(),
    );
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.resolve({ data, status: 200 });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    jest.advanceTimersByTime(1); // the request is sent 1 ms after invalidation happened
    const actual = await cacheFirstDataSource.get({
      cacheDir,
      url: targetUrl,
      notFoundExpireTimeSeconds,
    });

    expect(actual).toEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(2); // both data and invalidation timestamp are cached
    expect(await fakeCacheService.get(cacheDir)).toEqual(JSON.stringify(data)); // item is cached
  });

  it('should return the network data but it should not cache it if the last invalidation happened after the request was initiated', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const data = JSON.parse(fakeJson());
    const invalidationTimeMs = jest.now() + 1; // invalidation happens 1 ms after this point in time
    await fakeCacheService.set(
      new CacheDir(`invalidationTimeMs:${cacheDir.key}`, ''),
      invalidationTimeMs.toString(),
    );
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.resolve({ data, status: 200 });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    // the request is sent at this point in time (1 ms before invalidation happened)
    const actual = await cacheFirstDataSource.get({
      cacheDir,
      url: targetUrl,
      notFoundExpireTimeSeconds,
    });

    expect(actual).toEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(1); // only invalidation timestamp is cached
    await expect(fakeCacheService.get(cacheDir)).resolves.toEqual(undefined); // item is not cached
  });

  it('should return the cached data without calling the underlying network interface', async () => {
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const rawJson = fakeJson();
    await fakeCacheService.set(cacheDir, rawJson);
    mockNetworkService.get.mockImplementation((url) =>
      Promise.reject(`Unexpected request to ${url}`),
    );

    const actual = await cacheFirstDataSource.get({
      cacheDir,
      url: faker.internet.url({ appendSlash: false }),
      notFoundExpireTimeSeconds,
    });

    expect(actual).toEqual(JSON.parse(rawJson));
    expect(mockNetworkService.get).toHaveBeenCalledTimes(0);
  });

  it('should cache 404 errors coming from the network', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const expectedError = new NetworkResponseError(new URL(targetUrl), {
      status: 404,
    } as Response);
    const notFoundExpireTimeSeconds = faker.number.int();
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
      }),
    ).rejects.toThrow(expectedError);

    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(1);
  });

  it('should return a 404 cached error without a second call to the underlying network interface', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const expectedError = new NetworkResponseError(new URL(targetUrl), {
      status: 404,
    } as Response);
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
      }),
    ).rejects.toThrow(expectedError);

    await expect(
      cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
      }),
    ).rejects.toThrow(expectedError);

    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(1);
  });

  it('should cache not found errors with the default TTL', async () => {
    const mockCache = jest.mocked({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as ICacheService);

    cacheFirstDataSource = new CacheFirstDataSource(
      mockCache,
      mockNetworkService,
      mockLoggingService,
    );

    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const expectedError = new NetworkResponseError(new URL(targetUrl), {
      status: 404,
    } as Response);
    mockCache.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
      }),
    ).rejects.toThrow(expectedError);

    expect(mockCache.set).toHaveBeenCalledWith(
      cacheDir,
      expect.anything(),
      notFoundExpireTimeSeconds,
    );
  });

  it('should cache not found errors with a specific TTL', async () => {
    const mockCache = jest.mocked({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as ICacheService);

    cacheFirstDataSource = new CacheFirstDataSource(
      mockCache,
      mockNetworkService,
      mockLoggingService,
    );

    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const expectedError = new NetworkResponseError(new URL(targetUrl), {
      status: 404,
    } as Response);
    const notFoundExpireTimeSeconds = faker.number.int();
    mockCache.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int(),
      }),
    ).rejects.toThrow(expectedError);

    expect(mockCache.set).toHaveBeenCalledWith(
      cacheDir,
      expect.anything(),
      notFoundExpireTimeSeconds,
    );
  });
});
