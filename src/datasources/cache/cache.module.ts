import { Global, Module } from '@nestjs/common';
import { createClient } from 'redis';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import {
  PromiseTimeoutError,
  promiseWithTimeout,
} from '@/domain/common/utils/promise';

export type RedisClientType = ReturnType<typeof createClient>;

async function redisClientFactory(
  configurationService: IConfigurationService,
  loggingService: ILoggingService,
): Promise<RedisClientType> {
  const redisUser = configurationService.get<string>('redis.user');
  const redisPass = configurationService.get<string>('redis.pass');
  const redisHost = configurationService.getOrThrow<string>('redis.host');
  const redisPort = configurationService.getOrThrow<string>('redis.port');
  const redisTimeout = configurationService.getOrThrow<number>('redis.timeout');
  const redisDisableOfflineQueue = configurationService.getOrThrow<boolean>(
    'redis.disableOfflineQueue',
  );
  const client: RedisClientType = createClient({
    socket: {
      host: redisHost,
      port: Number(redisPort),
    },
    username: redisUser,
    password: redisPass,
    disableOfflineQueue: redisDisableOfflineQueue,
  });
  client.on('error', (err) =>
    loggingService.error(`Redis client error: ${err}`),
  );
  client.on('end', () => {
    loggingService.error('Redis client terminated!');
  });
  try {
    await promiseWithTimeout(client.connect(), redisTimeout);
  } catch (error) {
    if (error instanceof PromiseTimeoutError) {
      loggingService.error('Redis connect timed out!');
    }
  }
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: 'RedisClient',
      useFactory: redisClientFactory,
      inject: [IConfigurationService, LoggingService],
    },
    { provide: CacheService, useClass: RedisCacheService },
    { provide: CacheReadiness, useExisting: CacheService },
    { provide: CacheKeyPrefix, useValue: '' },
  ],
  exports: [CacheService, CacheReadiness],
})
export class CacheModule {}
