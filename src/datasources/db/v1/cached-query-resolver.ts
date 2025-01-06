import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class CachedQueryResolver implements ICachedQueryResolver {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {}

  /**
   * Returns the content from cache or executes the query, caches the result and returns it.
   * If the specified {@link CacheDir} is empty, the query is executed and the result is cached.
   * If the specified {@link CacheDir} is not empty, the pointed content is returned.
   *
   * @param cacheDir {@link CacheDir} to use for caching
   * @param query query to execute
   * @param ttl time to live for the cache
   * @returns content from cache or query result
   */
  async get<T extends Array<postgres.MaybeRow>>(args: {
    cacheDir: CacheDir;
    query: postgres.PendingQuery<T>;
    ttl: number;
  }): Promise<T> {
    const { key, field } = args.cacheDir;
    const cached = await this.cacheService.hGet(args.cacheDir);
    if (cached != null) {
      this.loggingService.debug({ type: 'cache_hit', key, field });
      return JSON.parse(cached);
    }
    this.loggingService.debug({ type: 'cache_miss', key, field });

    try {
      const result = await args.query.execute();
      if (result.count > 0) {
        await this.cacheService.hSet(
          args.cacheDir,
          JSON.stringify(result),
          args.ttl,
        );
      }
      return result;
    } catch (err) {
      // log & hide database errors
      this.loggingService.error(asError(err).message);
      throw new InternalServerErrorException();
    }
  }
}
