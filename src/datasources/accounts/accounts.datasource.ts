import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { CreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { AccountsCreationRateLimitError } from '@/domain/accounts/errors/accounts-creation-rate-limit.error';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { z } from 'zod';
import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import crypto from 'crypto';
import omit from 'lodash/omit';
import postgres from 'postgres';

@Injectable()
export class AccountsDatasource implements IAccountsDatasource, OnModuleInit {
  private static readonly ACCOUNT_CREATION_CACHE_PREFIX = 'account_creation';
  private readonly defaultExpirationTimeInSeconds: number;
  // Number of seconds for each rate-limit cycle
  private readonly accountCreationRateLimitPeriodSeconds: number;
  // Number of allowed calls on each rate-limit cycle
  private readonly accountCreationRateLimitCalls: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(ICachedQueryResolver)
    private readonly cachedQueryResolver: CachedQueryResolver,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IEncryptionApiManager)
    private readonly encryptionApiManager: IEncryptionApiManager,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.accountCreationRateLimitPeriodSeconds =
      configurationService.getOrThrow(
        'accounts.creationRateLimitPeriodSeconds',
      );
    this.accountCreationRateLimitCalls = configurationService.getOrThrow(
      'accounts.creationRateLimitCalls',
    );
  }

  /**
   * Function executed when the module is initialized.
   * It deletes the cache for persistent keys.
   */
  async onModuleInit(): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getAccountDataTypesCacheDir().key,
    );
  }

  /**
   * Account names need to be unique across the system, but they are encrypted, so
   * the same string could generate different encrypted values depending on the
   * encryption key used.
   *
   * This function hashes the name to ensure uniqueness. By hashing the name, we can
   * enforce a unique constraint on the hashed value, ensuring that no two names
   * will result in the same hash.
   */
  async createAccount(args: {
    createAccountDto: CreateAccountDto;
    clientIp: string;
  }): Promise<Account> {
    await this.checkCreationRateLimit(args.clientIp);
    const encryptedAccountData = await this.encryptAccountData(
      args.createAccountDto,
    );
    const [dbAccount] = await this.sql<[Account]>`
      INSERT INTO accounts (address, name, name_hash)
        VALUES (${encryptedAccountData.address}, ${encryptedAccountData.name}, ${encryptedAccountData.nameHash})
      RETURNING *
      `.catch((e) => {
      this.loggingService.warn(`Error creating account: ${asError(e).message}`);
      throw new UnprocessableEntityException('Error creating account.');
    });
    const cacheDir = CacheRouter.getAccountCacheDir(
      args.createAccountDto.address,
    );
    const account = {
      ...dbAccount,
      name: Buffer.from(dbAccount.name).toString('utf8'),
    };
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify([account]),
      this.defaultExpirationTimeInSeconds,
    );
    return omit(await this.decryptAccountData(account), 'name_hash');
  }

  async getAccount(address: `0x${string}`): Promise<Account> {
    const cacheDir = CacheRouter.getAccountCacheDir(address);
    const [account] = await this.cachedQueryResolver.get<Array<Account>>({
      cacheDir,
      query: this.sql`SELECT * FROM accounts WHERE address = ${address}`,
      ttl: this.defaultExpirationTimeInSeconds,
    });

    if (!account) {
      throw new NotFoundException('Error getting account.');
    }

    return this.decryptAccountData(account);
  }

  async deleteAccount(address: `0x${string}`): Promise<void> {
    try {
      const { count } = await this
        .sql`DELETE FROM accounts WHERE address = ${address}`;
      if (count === 0) {
        this.loggingService.debug(
          `Error deleting account ${address}: not found`,
        );
      }
    } finally {
      const keys = [
        CacheRouter.getAccountCacheDir(address).key,
        CacheRouter.getAccountDataSettingsCacheDir(address).key,
        CacheRouter.getCounterfactualSafesCacheDir(address).key,
      ];
      await Promise.all(keys.map((key) => this.cacheService.deleteByKey(key)));
    }
  }

  async getDataTypes(): Promise<Array<AccountDataType>> {
    const cacheDir = CacheRouter.getAccountDataTypesCacheDir();
    return this.cachedQueryResolver.get<Array<AccountDataType>>({
      cacheDir,
      query: this.sql`SELECT * FROM account_data_types`,
      ttl: MAX_TTL,
    });
  }

  async getAccountDataSettings(
    address: `0x${string}`,
  ): Promise<Array<AccountDataSetting>> {
    const account = await this.getAccount(address);
    const cacheDir = CacheRouter.getAccountDataSettingsCacheDir(address);
    return this.cachedQueryResolver.get<Array<AccountDataSetting>>({
      cacheDir,
      query: this.sql`
        SELECT ads.* FROM account_data_settings ads
          INNER JOIN account_data_types adt ON ads.account_data_type_id = adt.id
        WHERE ads.account_id = ${account.id} AND adt.is_active IS TRUE;`,
      ttl: this.defaultExpirationTimeInSeconds,
    });
  }

  /**
   * Adds or updates the existing account data settings for a given address/account.
   * Requirements:
   * - The account must exist.
   * - The data type must exist.
   * - The data type must be active.
   *
   * @param address - account address.
   * @param upsertAccountDataSettings {@link UpsertAccountDataSettingsDto} object.
   * @returns {Array<AccountDataSetting>} inserted account data settings.
   */
  async upsertAccountDataSettings(args: {
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<Array<AccountDataSetting>> {
    const { accountDataSettings } = args.upsertAccountDataSettingsDto;
    await this.checkDataTypes(accountDataSettings);
    const account = await this.getAccount(args.address);

    const result = await this.sql.begin(async (sql) => {
      await Promise.all(
        accountDataSettings.map(async (accountDataSetting) => {
          return sql`
            INSERT INTO account_data_settings (account_id, account_data_type_id, enabled)
            VALUES (${account.id}, ${accountDataSetting.dataTypeId}, ${accountDataSetting.enabled})
            ON CONFLICT (account_id, account_data_type_id) DO UPDATE SET enabled = EXCLUDED.enabled
          `.catch((e) => {
            throw new UnprocessableEntityException(
              `Error updating data settings: ${asError(e).message}`,
            );
          });
        }),
      );
      return sql<[AccountDataSetting]>`
        SELECT * FROM account_data_settings WHERE account_id = ${account.id}`;
    });

    const cacheDir = CacheRouter.getAccountDataSettingsCacheDir(args.address);
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(result),
      this.defaultExpirationTimeInSeconds,
    );
    return result;
  }

  private async checkDataTypes(
    accountDataSettings: UpsertAccountDataSettingsDto['accountDataSettings'],
  ): Promise<void> {
    const dataTypes = await this.getDataTypes();
    const activeDataTypeIds = dataTypes
      .filter((dt) => dt.is_active)
      .map((ads) => ads.id);
    if (
      !accountDataSettings.every((ads) =>
        activeDataTypeIds.includes(Number(ads.dataTypeId)),
      )
    ) {
      throw new UnprocessableEntityException(
        `Data types not found or not active.`,
      );
    }
  }

  /**
   * Checks if the client IP address has reached the account creation rate limit.
   *
   * NOTE: the rate limit is implemented in the datasource layer for this use case
   * because we need to restrict the actual creation of accounts, not merely
   * the attempts to create them.
   *
   * If the client IP address is invalid, a warning is logged.
   * If the client IP address is valid and rate limit is reached, a {@link AccountsCreationRateLimitError} is thrown.
   *
   * @param clientIp - client IP address.
   */
  private async checkCreationRateLimit(clientIp: string): Promise<void> {
    const { success: isValidIp } = z.string().ip().safeParse(clientIp);
    if (!isValidIp) {
      this.loggingService.warn(
        `Invalid client IP while creating account: ${clientIp}`,
      );
    } else {
      const current = await this.cacheService.increment(
        CacheRouter.getRateLimitCacheKey(
          `${AccountsDatasource.ACCOUNT_CREATION_CACHE_PREFIX}_${clientIp}`,
        ),
        this.accountCreationRateLimitPeriodSeconds,
      );
      if (current > this.accountCreationRateLimitCalls) {
        this.loggingService.warn(
          `Limit of ${this.accountCreationRateLimitCalls} reached for IP ${clientIp}`,
        );
        throw new AccountsCreationRateLimitError();
      }
    }
  }

  async encryptAccountData(
    createAccountDto: CreateAccountDto,
  ): Promise<{ address: `0x${string}`; name: string; nameHash: string }> {
    const hash = crypto.createHash('sha256');
    hash.update(createAccountDto.name);
    const nameHash = hash.digest('hex');
    const api = await this.encryptionApiManager.getApi();
    const encryptedName = await api.encrypt(createAccountDto.name);
    return { address: createAccountDto.address, name: encryptedName, nameHash };
  }

  async decryptAccountData(account: Account): Promise<Account> {
    const api = await this.encryptionApiManager.getApi();
    return { ...account, name: await api.decrypt(account.name) };
  }
}
