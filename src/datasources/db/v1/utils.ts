import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { InternalServerErrorException } from '@nestjs/common';
import type postgres from 'postgres';

/**
 * Returns the content from cache or executes the query and caches the result.
 * If the specified {@link CacheDir} is empty, the query is executed and the result is cached.
 * If the specified {@link CacheDir} is not empty, the pointed content is returned.
 *
 * @param loggingService {@link ILoggingService} to use for logging
 * @param cacheService {@link ICacheService} to use for caching
 * @param cacheDir {@link CacheDir} to use for caching
 * @param query query to execute
 * @param ttl time to live for the cache
 * @returns content from cache or query result
 */
// TODO: add tests
export async function getFromCacheOrExecuteAndCache<
  T extends Array<postgres.MaybeRow>,
>(
  loggingService: ILoggingService,
  cacheService: ICacheService,
  cacheDir: CacheDir,
  query: postgres.PendingQuery<T>,
  ttl: number,
): Promise<T> {
  const { key, field } = cacheDir;
  const cached = await cacheService.hGet(cacheDir);
  if (cached != null) {
    loggingService.debug({ type: 'cache_hit', key, field });
    return JSON.parse(cached);
  }
  loggingService.debug({ type: 'cache_miss', key, field });

  // log & hide database errors
  const result = await query.catch((e) => {
    loggingService.error(asError(e).message);
    throw new InternalServerErrorException();
  });

  if (result.count > 0) {
    await cacheService.hSet(cacheDir, JSON.stringify(result), ttl);
  }
  return result;
}
