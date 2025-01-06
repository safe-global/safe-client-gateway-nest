import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { CounterfactualSafesCreationRateLimitError } from '@/domain/accounts/counterfactual-safes/errors/counterfactual-safes-creation-rate-limit.error';
import { Account } from '@/domain/accounts/entities/account.entity';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class CounterfactualSafesDatasource
  implements ICounterfactualSafesDatasource
{
  private static readonly COUNTERFACTUAL_SAFES_CREATION_CACHE_PREFIX =
    'counterfactual_safes_creation';
  private readonly defaultExpirationTimeInSeconds: number;
  // Number of seconds for each rate-limit cycle
  private readonly counterfactualSafesCreationRateLimitPeriodSeconds: number;
  // Number of allowed calls on each rate-limit cycle
  private readonly counterfactualSafesCreationRateLimitCalls: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(ICachedQueryResolver)
    private readonly cachedQueryResolver: CachedQueryResolver,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.counterfactualSafesCreationRateLimitPeriodSeconds =
      configurationService.getOrThrow(
        'accounts.counterfactualSafes.creationRateLimitPeriodSeconds',
      );
    this.counterfactualSafesCreationRateLimitCalls =
      configurationService.getOrThrow(
        'accounts.counterfactualSafes.creationRateLimitCalls',
      );
  }

  async createCounterfactualSafe(args: {
    account: Account;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe> {
    await this.checkCreationRateLimit(args.account);
    const [counterfactualSafe] = await this.sql<Array<CounterfactualSafe>>`
      INSERT INTO counterfactual_safes 
      ${this.sql([this.mapCreationDtoToRow(args.account, args.createCounterfactualSafeDto)])}
      RETURNING *`;
    const { key } = CacheRouter.getCounterfactualSafesCacheDir(
      args.account.address,
    );
    await this.cacheService.deleteByKey(key);
    return counterfactualSafe;
  }

  async getCounterfactualSafe(args: {
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<CounterfactualSafe> {
    const cacheDir = CacheRouter.getCounterfactualSafeCacheDir(
      args.chainId,
      args.predictedAddress,
    );
    const [counterfactualSafe] = await this.cachedQueryResolver.get<
      Array<CounterfactualSafe>
    >({
      cacheDir,
      query: this.sql<Array<CounterfactualSafe>>`
        SELECT * FROM counterfactual_safes 
        WHERE account_id = (SELECT id FROM accounts WHERE address = ${args.address})
          AND chain_id = ${args.chainId}
          AND predicted_address = ${args.predictedAddress}`,
      ttl: this.defaultExpirationTimeInSeconds,
    });

    if (!counterfactualSafe) {
      throw new NotFoundException('Error getting Counterfactual Safe.');
    }

    return counterfactualSafe;
  }

  getCounterfactualSafesForAddress(
    address: `0x${string}`,
  ): Promise<Array<CounterfactualSafe>> {
    const cacheDir = CacheRouter.getCounterfactualSafesCacheDir(address);
    return this.cachedQueryResolver.get<Array<CounterfactualSafe>>({
      cacheDir,
      query: this.sql<Array<CounterfactualSafe>>`
        SELECT * FROM counterfactual_safes WHERE account_id = 
          (SELECT id FROM accounts WHERE address = ${address})`,
      ttl: this.defaultExpirationTimeInSeconds,
    });
  }

  async deleteCounterfactualSafe(args: {
    account: Account;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<void> {
    try {
      const { count } = await this
        .sql`DELETE FROM counterfactual_safes WHERE chain_id = ${args.chainId} AND predicted_address = ${args.predictedAddress} AND account_id = ${args.account.id}`;
      if (count === 0) {
        this.loggingService.debug(
          `Error deleting Counterfactual Safe (${args.chainId}, ${args.predictedAddress}): not found`,
        );
      }
    } finally {
      await Promise.all([
        this.cacheService.deleteByKey(
          CacheRouter.getCounterfactualSafeCacheDir(
            args.chainId,
            args.predictedAddress,
          ).key,
        ),
        this.cacheService.deleteByKey(
          CacheRouter.getCounterfactualSafesCacheDir(args.account.address).key,
        ),
      ]);
    }
  }

  async deleteCounterfactualSafesForAccount(account: Account): Promise<void> {
    let deleted: Array<CounterfactualSafe> = [];
    try {
      const rows = await this.sql<
        Array<CounterfactualSafe>
      >`DELETE FROM counterfactual_safes WHERE account_id = ${account.id} RETURNING *`;
      deleted = rows;
    } finally {
      await this.cacheService.deleteByKey(
        CacheRouter.getCounterfactualSafesCacheDir(account.address).key,
      );
      await Promise.all(
        deleted.map((row) => {
          return this.cacheService.deleteByKey(
            CacheRouter.getCounterfactualSafeCacheDir(
              row.chain_id,
              row.predicted_address,
            ).key,
          );
        }),
      );
    }
  }

  private async checkCreationRateLimit(account: Account): Promise<void> {
    const current = await this.cacheService.increment(
      CacheRouter.getRateLimitCacheKey(
        `${CounterfactualSafesDatasource.COUNTERFACTUAL_SAFES_CREATION_CACHE_PREFIX}_${account.address}`,
      ),
      this.counterfactualSafesCreationRateLimitPeriodSeconds,
    );
    if (current > this.counterfactualSafesCreationRateLimitCalls) {
      this.loggingService.warn(
        `Limit of ${this.counterfactualSafesCreationRateLimitCalls} reached for account ${account.address}`,
      );
      throw new CounterfactualSafesCreationRateLimitError();
    }
  }

  private mapCreationDtoToRow(
    account: Account,
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Partial<CounterfactualSafe> {
    return {
      account_id: account.id,
      chain_id: createCounterfactualSafeDto.chainId,
      creator: account.address,
      fallback_handler: createCounterfactualSafeDto.fallbackHandler,
      owners: createCounterfactualSafeDto.owners,
      predicted_address: createCounterfactualSafeDto.predictedAddress,
      salt_nonce: createCounterfactualSafeDto.saltNonce,
      singleton_address: createCounterfactualSafeDto.singletonAddress,
      threshold: createCounterfactualSafeDto.threshold,
    };
  }
}
