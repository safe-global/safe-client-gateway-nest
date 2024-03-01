import { Inject, Injectable } from '@nestjs/common';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

/**
 * A data source which tries to retrieve values from cache using
 * {@link CacheService} and fallbacks to {@link NetworkService}
 * if the cache entry expired or is not present.
 *
 * This is the recommended data source that should be used when
 * a feature requires both networking and caching the respective
 * responses.
 */
@Injectable()
export class CacheFirstDataSource {
  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Gets the cached value behind {@link CacheDir}.
   * If the value is not present, it tries to get the respective JSON
   * payload from {@link url}.
   * 404 errors are cached with {@link notFoundExpireTimeSeconds} seconds expiration time.
   *
   * @param args.cacheDir - {@link CacheDir} containing the key and field to be used to retrieve from cache
   * @param args.url - the HTTP endpoint to retrieve the JSON payload
   * @param args.networkRequest - the HTTP request to be used if there is a cache miss
   * @param args.expireTimeSeconds - the time to live in seconds for the payload behind {@link CacheDir}
   * @param args.notFoundExpireTimeSeconds - the time to live in seconds for the error when the item is not found
   */
  async get<T>(args: {
    cacheDir: CacheDir;
    url: string;
    notFoundExpireTimeSeconds: number;
    networkRequest?: NetworkRequest;
    expireTimeSeconds?: number;
  }): Promise<T> {
    const cached = await this.cacheService.get(args.cacheDir);
    if (cached != null) return this._getFromCachedData(args.cacheDir, cached);

    try {
      return await this._getFromNetworkAndWriteCache(args);
    } catch (error) {
      if (
        error instanceof NetworkResponseError &&
        error.response.status === 404
      ) {
        await this.cacheNotFoundError(
          args.cacheDir,
          error,
          args.notFoundExpireTimeSeconds,
        );
      }
      throw error;
    }
  }

  /**
   * Gets the data from the contents stored in the cache.
   */
  private _getFromCachedData<T>(
    { key, field }: CacheDir,
    cached: string,
  ): Promise<T> {
    this.loggingService.debug({ type: 'cache_hit', key, field });
    const cachedData = JSON.parse(cached);
    if (cachedData?.response?.status === 404) {
      throw new NetworkResponseError(
        cachedData.url,
        cachedData.response,
        cachedData?.data,
      );
    }
    return cachedData;
  }

  /**
   * Gets the data from the network and caches the result.
   */
  private async _getFromNetworkAndWriteCache<T>(args: {
    cacheDir: CacheDir;
    url: string;
    networkRequest?: NetworkRequest;
    expireTimeSeconds?: number;
  }): Promise<T> {
    const { key, field } = args.cacheDir;
    this.loggingService.debug({ type: 'cache_miss', key, field });
    const startTimeMs = Date.now();
    const { data } = await this.networkService.get(
      args.url,
      args.networkRequest,
    );

    const shouldBeCached = await this._shouldBeCached(key, startTimeMs);
    if (shouldBeCached) {
      await this.cacheService.set(
        args.cacheDir,
        JSON.stringify(data),
        args.expireTimeSeconds,
      );
    }
    return data;
  }

  /**
   * Validates that the request is more recent than the last invalidation recorded for the item,
   * preventing a race condition where outdated data is stored due to the request being initiated
   * before the source communicated a change (via webhook or by other means).
   *
   * Returns true if (any of the following):
   * 1. An invalidationTimeMs entry for the key received as param is *not* found in the cache.
   * 2. An entry *is* found and contains an integer that is less than the received startTimeMs param.
   *
   * @param key key part of the {@link CacheDir} holding the requested item
   * @param startTimeMs Unix epoch timestamp in ms when the request was initiated
   * @returns true if any of the above conditions is met
   */
  private async _shouldBeCached(
    key: string,
    startTimeMs: number,
  ): Promise<boolean> {
    const invalidationTimeMsStr = await this.cacheService.get(
      new CacheDir(`invalidationTimeMs:${key}`, ''),
    );

    if (!invalidationTimeMsStr) return true;

    const invalidationTimeMs = Number(invalidationTimeMsStr);
    return (
      Number.isInteger(invalidationTimeMs) && invalidationTimeMs < startTimeMs
    );
  }

  /**
   * Caches a not found error.
   * @param cacheDir - {@link CacheDir} where the error should be placed
   */
  private async cacheNotFoundError(
    cacheDir: CacheDir,
    error: NetworkResponseError,
    notFoundExpireTimeSeconds?: number,
  ): Promise<void> {
    return this.cacheService.set(
      cacheDir,
      JSON.stringify(error),
      notFoundExpireTimeSeconds,
    );
  }
}
