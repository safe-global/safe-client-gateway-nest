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
import { Page } from '@/domain/entities/page.entity';
import {
  isMultisigTransaction,
  isEthereumTransaction,
  isModuleTransaction,
  isCreationTransaction,
  Transaction,
} from '@/domain/safe/entities/transaction.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Raw } from '@/validation/entities/raw.entity';

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
  private readonly areDebugLogsEnabled: boolean;
  private readonly areConfigHooksDebugLogsEnabled: boolean;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.areDebugLogsEnabled =
      this.configurationService.getOrThrow<boolean>('features.debugLogs');
    this.areConfigHooksDebugLogsEnabled =
      this.configurationService.getOrThrow<boolean>(
        'features.configHooksDebugLogs',
      );
  }

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
  }): Promise<Raw<T>> {
    const cached = await this.cacheService.hGet(args.cacheDir);
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
      // TODO: create a CachedData type with guard to avoid these type assertions.
      const url: URL = cachedData.url;
      const response: Response = cachedData.response;
      throw new NetworkResponseError(url, response, cachedData?.data);
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
  }): Promise<Raw<T>> {
    const { key, field } = args.cacheDir;
    this.loggingService.debug({ type: 'cache_miss', key, field });
    const startTimeMs = Date.now();
    const { data } = await this.networkService.get<T>({
      url: args.url,
      networkRequest: args.networkRequest,
    });

    const shouldBeCached = await this._shouldBeCached(key, startTimeMs);
    if (shouldBeCached) {
      await this.cacheService.hSet(
        args.cacheDir,
        JSON.stringify(data),
        args.expireTimeSeconds,
      );

      // TODO: transient logging for debugging
      if (
        this.areDebugLogsEnabled &&
        (args.url.includes('all-transactions') ||
          args.url.includes('multisig-transactions'))
      ) {
        this.logTransactionsCacheWrite(
          startTimeMs,
          args.cacheDir,
          data as unknown as Page<Transaction>,
        );
      }

      if (this.areDebugLogsEnabled && args.cacheDir.key.includes('_safe_')) {
        this.logSafeMetadataCacheWrite(
          startTimeMs,
          args.cacheDir,
          data as unknown as Safe,
        );
      }

      if (
        this.areConfigHooksDebugLogsEnabled &&
        args.cacheDir.key.includes('chain')
      ) {
        this.logChainUpdateCacheWrite(startTimeMs, args.cacheDir, data);
      }
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
    const invalidationTimeMsStr = await this.cacheService.hGet(
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
    return this.cacheService.hSet(
      cacheDir,
      JSON.stringify({
        data: error.data,
        response: { status: error.response.status },
        url: error.url,
      }),
      notFoundExpireTimeSeconds,
    );
  }

  /**
   * Logs the type and the hash of the transactions present in the data parameter.
   * NOTE: this is a debugging-only function.
   * TODO: remove this function after debugging.
   */
  private logTransactionsCacheWrite(
    requestStartTime: number,
    cacheDir: CacheDir,
    data: Page<Transaction>,
  ): void {
    this.loggingService.info({
      type: 'cache_write',
      cacheKey: cacheDir.key,
      cacheField: cacheDir.field,
      cacheWriteTime: new Date(),
      requestStartTime: new Date(requestStartTime),
      txHashes:
        Array.isArray(data?.results) && // no validation executed yet at this point
        data.results.map((transaction) => {
          if (isMultisigTransaction(transaction)) {
            return {
              txType: 'multisig',
              safeTxHash: transaction.safeTxHash,
              confirmations: transaction.confirmations,
              confirmationRequired: transaction.confirmationsRequired,
            };
          } else if (isEthereumTransaction(transaction)) {
            return {
              txType: 'ethereum',
              txHash: transaction.txHash,
            };
          } else if (isModuleTransaction(transaction)) {
            return {
              txType: 'module',
              transactionHash: transaction.transactionHash,
            };
          } else if (isCreationTransaction(transaction)) {
            return {
              txType: 'creation',
              transactionHash: transaction.transactionHash,
            };
          }
        }),
    });
  }

  /**
   * Logs the Safe metadata retrieved.
   * NOTE: this is a debugging-only function.
   * TODO: remove this function after debugging.
   */
  private logSafeMetadataCacheWrite(
    requestStartTime: number,
    cacheDir: CacheDir,
    safe: Safe,
  ): void {
    this.loggingService.info({
      type: 'cache_write',
      cacheKey: cacheDir.key,
      cacheField: cacheDir.field,
      cacheWriteTime: new Date(),
      requestStartTime: new Date(requestStartTime),
      safe,
    });
  }

  /**
   * Logs the chain/chains retrieved.
   * NOTE: this is a debugging-only function.
   * TODO: remove this function after debugging.
   */
  private logChainUpdateCacheWrite(
    requestStartTime: number,
    cacheDir: CacheDir,
    data: unknown,
  ): void {
    this.loggingService.info({
      type: 'cache_write',
      cacheKey: cacheDir.key,
      cacheField: cacheDir.field,
      cacheWriteTime: new Date(),
      requestStartTime: new Date(requestStartTime),
      data,
    });
  }
}
