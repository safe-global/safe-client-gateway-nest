import {
  Inject,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisClientType } from '@/datasources/cache/cache.module';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ICacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import {
  PromiseTimeoutError,
  promiseWithTimeout,
} from '@/domain/common/utils/promise';

@Injectable()
export class RedisCacheService
  implements ICacheService, ICacheReadiness, OnModuleDestroy
{
  private readonly quitTimeoutInSeconds: number = 2;
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject('RedisClient') private readonly client: RedisClientType,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheKeyPrefix) private readonly keyPrefix: string,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async ping(): Promise<unknown> {
    return this.client.ping();
  }

  ready(): boolean {
    return this.client.isReady;
  }

  async getCounter(key: string): Promise<number | null> {
    this.validatgeRedisClientIsReady();

    const value = await this.client.get(this._prefixKey(key));
    const numericValue = Number(value);
    return Number.isInteger(numericValue) ? numericValue : null;
  }

  async hSet(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds: number | undefined,
  ): Promise<void> {
    this.validatgeRedisClientIsReady();

    if (!expireTimeSeconds || expireTimeSeconds <= 0) {
      return;
    }

    const key = this._prefixKey(cacheDir.key);

    try {
      await this.timeout(this.client.hSet(key, cacheDir.field, value));
      // NX - Set expiry only when the key has no expiry
      // See https://redis.io/commands/expire/
      await this.timeout(this.client.expire(key, expireTimeSeconds, 'NX'));
    } catch (error) {
      await this.timeout(this.client.hDel(key, cacheDir.field));
      throw error;
    }
  }

  async hGet(cacheDir: CacheDir): Promise<string | undefined> {
    this.validatgeRedisClientIsReady();

    const key = this._prefixKey(cacheDir.key);
    return await this.timeout(this.client.hGet(key, cacheDir.field));
  }

  async deleteByKey(key: string): Promise<number> {
    this.validatgeRedisClientIsReady();

    const keyWithPrefix = this._prefixKey(key);
    // see https://redis.io/commands/unlink/
    const result = await this.timeout(this.client.unlink(keyWithPrefix));
    await this.timeout(
      this.hSet(
        new CacheDir(`invalidationTimeMs:${key}`, ''),
        Date.now().toString(),
        this.defaultExpirationTimeInSeconds,
      ),
    );
    return result;
  }

  async increment(
    cacheKey: string,
    expireTimeSeconds: number | undefined,
  ): Promise<number> {
    this.validatgeRedisClientIsReady();

    const transaction = this.client.multi().incr(cacheKey);
    if (expireTimeSeconds !== undefined && expireTimeSeconds > 0) {
      transaction.expire(cacheKey, expireTimeSeconds, 'NX');
    }
    const [incrRes] = await transaction.get(cacheKey).exec();
    return Number(incrRes);
  }

  async setCounter(
    key: string,
    value: number,
    expireTimeSeconds: number,
  ): Promise<void> {
    this.validatgeRedisClientIsReady();

    await this.client.set(key, value, { EX: expireTimeSeconds, NX: true });
  }

  /**
   * Constructs a prefixed key string.
   *
   * This function takes a key string as an input and prefixes it with `this.keyPrefix`.
   * If `this.keyPrefix` is empty, it returns the original key without any prefix.
   *
   * @param key - The original key string that needs to be prefixed.
   * @returns A string that combines `this.keyPrefix` and the original `key` with a hyphen.
   *          If `this.keyPrefix` is empty, the original `key` is returned without any modification.
   * @private
   */
  private _prefixKey(key: string): string {
    if (this.keyPrefix.length === 0) {
      return key;
    }

    return `${this.keyPrefix}-${key}`;
  }

  /**
   * Closes the connection to Redis when the module associated with this service
   * is destroyed. This tries to gracefully close the connection. If the Redis
   * instance is not responding it invokes {@link forceQuit}.
   */
  async onModuleDestroy(): Promise<void> {
    this.validatgeRedisClientIsReady();

    this.loggingService.info('Closing Redis connection...');
    try {
      await promiseWithTimeout(
        this.client.quit(),
        this.quitTimeoutInSeconds * 1000,
      );
      this.loggingService.info('Redis connection closed');
    } catch (error) {
      if (error instanceof PromiseTimeoutError) {
        await this.forceQuit();
      }
    }
  }

  /**
   * Forces the closing of the Redis connection associated with this service.
   */
  private async forceQuit(): Promise<void> {
    this.validatgeRedisClientIsReady();
    this.loggingService.warn('Forcing Redis connection to close...');
    try {
      await this.client.disconnect();
      this.loggingService.warn('Redis connection forcefully closed!');
    } catch (error) {
      this.loggingService.error(`Cannot close Redis connection: ${error}`);
    }
  }

  private async timeout<T>(
    queryObject: Promise<T>,
    timeout?: number,
  ): Promise<T> {
    timeout =
      timeout ?? this.configurationService.getOrThrow<number>('redis.timeout');
    try {
      return await promiseWithTimeout(queryObject, timeout);
    } catch (error) {
      if (error instanceof PromiseTimeoutError) {
        this.loggingService.error('Redis Query Timed out!');
      }

      throw error;
    }
  }

  private validatgeRedisClientIsReady(): void {
    if (!this.ready()) {
      this.loggingService.error(`Redis client is not ready`);

      throw new ServiceUnavailableException('Redis client is not ready');
    }
  }
}
