import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CounterfactualSafesDatasource } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { createCounterfactualSafeDtoBuilder } from '@/domain/accounts/counterfactual-safes/entities/__tests__/create-counterfactual-safe.dto.entity.builder';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { createAccountDtoBuilder } from '@/domain/accounts/entities/__tests__/create-account.dto.builder';
import type { Account } from '@/domain/accounts/entities/account.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('CounterfactualSafesDatasource tests', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: CounterfactualSafesDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });

    target = new CounterfactualSafesDatasource(
      fakeCacheService,
      sql,
      new CachedQueryResolver(mockLoggingService, fakeCacheService),
      mockLoggingService,
      mockConfigurationService,
    );
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE accounts, account_data_settings, counterfactual_safes CASCADE`;
    fakeCacheService.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('createCounterfactualSafe', () => {
    it('should create a Counterfactual Safe', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const createCounterfactualSafeDto =
        createCounterfactualSafeDtoBuilder().build();

      const actual = await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto,
      });
      expect(actual).toStrictEqual(
        expect.objectContaining({
          id: expect.any(Number),
          chain_id: createCounterfactualSafeDto.chainId,
          creator: account.address,
          fallback_handler: createCounterfactualSafeDto.fallbackHandler,
          owners: createCounterfactualSafeDto.owners,
          predicted_address: createCounterfactualSafeDto.predictedAddress,
          salt_nonce: createCounterfactualSafeDto.saltNonce,
          singleton_address: createCounterfactualSafeDto.singletonAddress,
          threshold: createCounterfactualSafeDto.threshold,
          account_id: account.id,
        }),
      );
    });

    it('should create a Counterfactual Safe if the rate limit is not hit', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const creationRateLimitCalls = faker.number.int({ min: 5, max: 10 });
      const createCounterfactualSafes = faker.helpers.multiple(
        (_, i) =>
          createCounterfactualSafeDtoBuilder()
            .with('chainId', i.toString())
            .build(),
        { count: creationRateLimitCalls },
      );

      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        switch (key) {
          case 'expirationTimeInSeconds.default':
            return faker.number.int();
          case 'accounts.counterfactualSafes.creationRateLimitPeriodSeconds':
            return faker.number.int({ min: 10 });
          case 'accounts.counterfactualSafes.creationRateLimitCalls':
            return creationRateLimitCalls;
        }
      });

      target = new CounterfactualSafesDatasource(
        fakeCacheService,
        sql,
        new CachedQueryResolver(mockLoggingService, fakeCacheService),
        mockLoggingService,
        mockConfigurationService,
      );

      for (let i = 0; i < creationRateLimitCalls - 1; i++) {
        await target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafes[i],
        });
      }

      const lastCounterfactualSafe =
        createCounterfactualSafes[createCounterfactualSafes.length - 1];
      const actual = await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto: lastCounterfactualSafe,
      });
      expect(actual).toStrictEqual(
        expect.objectContaining({
          id: expect.any(Number),
          chain_id: lastCounterfactualSafe.chainId,
          creator: account.address,
          fallback_handler: lastCounterfactualSafe.fallbackHandler,
          owners: lastCounterfactualSafe.owners,
          predicted_address: lastCounterfactualSafe.predictedAddress,
          salt_nonce: lastCounterfactualSafe.saltNonce,
          singleton_address: lastCounterfactualSafe.singletonAddress,
          threshold: lastCounterfactualSafe.threshold,
          account_id: account.id,
        }),
      );
    });

    it('should fail if the rate limit is hit', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const creationRateLimitCalls = faker.number.int({ min: 5, max: 10 });
      const createCounterfactualSafes = faker.helpers.multiple(
        (_, i) =>
          createCounterfactualSafeDtoBuilder()
            .with('chainId', i.toString())
            .build(),
        { count: creationRateLimitCalls },
      );

      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        switch (key) {
          case 'expirationTimeInSeconds.default':
            return faker.number.int();
          case 'accounts.counterfactualSafes.creationRateLimitPeriodSeconds':
            return faker.number.int({ min: 10 });
          case 'accounts.counterfactualSafes.creationRateLimitCalls':
            return creationRateLimitCalls;
        }
      });

      target = new CounterfactualSafesDatasource(
        fakeCacheService,
        sql,
        new CachedQueryResolver(mockLoggingService, fakeCacheService),
        mockLoggingService,
        mockConfigurationService,
      );

      for (let i = 0; i < creationRateLimitCalls; i++) {
        await target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafes[i],
        });
      }

      await expect(
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '11')
            .build(),
        }),
      ).rejects.toThrow('Counterfactual Safes creation rate limit reached');
    });

    it('should delete the cache for the account Counterfactual Safes', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto:
          createCounterfactualSafeDtoBuilder().build(),
      });
      await target.getCounterfactualSafesForAddress(createAccountDto.address);
      const cacheDir = new CacheDir(
        `counterfactual_safes_${createAccountDto.address}`,
        '',
      );
      await fakeCacheService.hSet(
        cacheDir,
        JSON.stringify([]),
        faker.number.int(),
      );

      // the cache is cleared after creating a new CF Safe for the same account
      await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto:
          createCounterfactualSafeDtoBuilder().build(),
      });
      expect(await fakeCacheService.hGet(cacheDir)).toBeUndefined();
    });
  });

  describe('getCounterfactualSafe', () => {
    it('should get a Counterfactual Safe', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto:
          createCounterfactualSafeDtoBuilder().build(),
      });

      const actual = await target.getCounterfactualSafe({
        address: createAccountDto.address,
        chainId: counterfactualSafe.chain_id,
        predictedAddress: counterfactualSafe.predicted_address,
      });
      expect(actual).toStrictEqual(counterfactualSafe);
    });

    it('returns a Counterfactual Safe from cache', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto:
          createCounterfactualSafeDtoBuilder().build(),
      });

      // first call is not cached
      const actual = await target.getCounterfactualSafe({
        address: createAccountDto.address,
        chainId: counterfactualSafe.chain_id,
        predictedAddress: counterfactualSafe.predicted_address,
      });
      await target.getCounterfactualSafe({
        address: createAccountDto.address,
        chainId: counterfactualSafe.chain_id,
        predictedAddress: counterfactualSafe.predicted_address,
      });

      expect(actual).toStrictEqual(counterfactualSafe);
      const cacheDir = new CacheDir(
        `${counterfactualSafe.chain_id}_counterfactual_safe_${counterfactualSafe.predicted_address}`,
        '',
      );
      const cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'cache_miss',
        key: `${counterfactualSafe.chain_id}_counterfactual_safe_${counterfactualSafe.predicted_address}`,
        field: '',
      });
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'cache_hit',
        key: `${counterfactualSafe.chain_id}_counterfactual_safe_${counterfactualSafe.predicted_address}`,
        field: '',
      });
    });

    it('should not cache if the Counterfactual Safe is not found', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const counterfactualSafe = createCounterfactualSafeDtoBuilder().build();

      // should not cache the Counterfactual Safe
      await expect(
        target.getCounterfactualSafe({
          address,
          chainId: counterfactualSafe.chainId,
          predictedAddress: counterfactualSafe.predictedAddress,
        }),
      ).rejects.toThrow('Error getting Counterfactual Safe.');
      await expect(
        target.getCounterfactualSafe({
          address,
          chainId: counterfactualSafe.chainId,
          predictedAddress: counterfactualSafe.predictedAddress,
        }),
      ).rejects.toThrow('Error getting Counterfactual Safe.');

      const cacheDir = new CacheDir(
        `${counterfactualSafe.chainId}_counterfactual_safe_${counterfactualSafe.predictedAddress}`,
        '',
      );
      expect(await fakeCacheService.hGet(cacheDir)).toBeUndefined();
      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'cache_miss',
        key: `${counterfactualSafe.chainId}_counterfactual_safe_${counterfactualSafe.predictedAddress}`,
        field: '',
      });
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'cache_miss',
        key: `${counterfactualSafe.chainId}_counterfactual_safe_${counterfactualSafe.predictedAddress}`,
        field: '',
      });
    });
  });

  describe('getCounterfactualSafesForAddress', () => {
    it('should get the Counterfactual Safes for an address', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '1')
            .build(),
        }),
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '2')
            .build(),
        }),
      ]);

      const actual = await target.getCounterfactualSafesForAddress(
        createAccountDto.address,
      );
      expect(actual).toStrictEqual(expect.arrayContaining(counterfactualSafes));
    });

    it('should get the Counterfactual Safes for an account from cache', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '1')
            .build(),
        }),
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '2')
            .build(),
        }),
      ]);

      // first call is not cached
      const actual = await target.getCounterfactualSafesForAddress(
        createAccountDto.address,
      );
      await target.getCounterfactualSafesForAddress(createAccountDto.address);

      expect(actual).toStrictEqual(expect.arrayContaining(counterfactualSafes));
      const cacheDir = new CacheDir(
        `counterfactual_safes_${createAccountDto.address}`,
        '',
      );
      const cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(2);
      expect(mockLoggingService.debug).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'cache_miss',
        key: `counterfactual_safes_${account.address}`,
        field: '',
      });
      expect(mockLoggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'cache_hit',
        key: `counterfactual_safes_${account.address}`,
        field: '',
      });
    });
  });

  describe('deleteCounterfactualSafe', () => {
    it('should delete a Counterfactual Safe', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto:
          createCounterfactualSafeDtoBuilder().build(),
      });

      await expect(
        target.deleteCounterfactualSafe({
          account,
          chainId: counterfactualSafe.chain_id,
          predictedAddress: counterfactualSafe.predicted_address,
        }),
      ).resolves.not.toThrow();

      expect(mockLoggingService.debug).not.toHaveBeenCalled();
    });

    it('should not throw if no Counterfactual Safe is found', async () => {
      await expect(
        target.deleteCounterfactualSafe({
          account: accountBuilder().build(),
          chainId: faker.string.numeric({ length: 6 }),
          predictedAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).resolves.not.toThrow();

      expect(mockLoggingService.debug).toHaveBeenCalledTimes(1);
    });

    it('should clear the cache on Counterfactual Safe deletion', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafe = await target.createCounterfactualSafe({
        account,
        createCounterfactualSafeDto:
          createCounterfactualSafeDtoBuilder().build(),
      });

      // the Counterfactual Safe is cached
      await target.getCounterfactualSafe({
        address: createAccountDto.address,
        chainId: counterfactualSafe.chain_id,
        predictedAddress: counterfactualSafe.predicted_address,
      });
      const cacheDir = new CacheDir(
        `${counterfactualSafe.chain_id}_counterfactual_safe_${counterfactualSafe.predicted_address}`,
        '',
      );
      const beforeDeletion = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(beforeDeletion as string)).toHaveLength(1);

      // the counterfactualSafe is deleted from the database and the cache
      await expect(
        target.deleteCounterfactualSafe({
          account,
          chainId: counterfactualSafe.chain_id,
          predictedAddress: counterfactualSafe.predicted_address,
        }),
      ).resolves.not.toThrow();
      await expect(
        target.getCounterfactualSafe({
          address: createAccountDto.address,
          chainId: counterfactualSafe.chain_id,
          predictedAddress: counterfactualSafe.predicted_address,
        }),
      ).rejects.toThrow();

      const afterDeletion = await fakeCacheService.hGet(cacheDir);
      expect(afterDeletion).toBeUndefined();
      const cacheDirByAddress = new CacheDir(
        `counterfactual_safes_${createAccountDto.address}`,
        '',
      );
      const cachedByAddress = await fakeCacheService.hGet(cacheDirByAddress);
      expect(cachedByAddress).toBeUndefined();
    });
  });

  describe('deleteCounterfactualSafesForAccount', () => {
    it('should delete all the Counterfactual Safes for an account', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<
        Array<Account>
      >`INSERT INTO accounts (address, name, name_hash) VALUES (${createAccountDto.address}, ${createAccountDto.name}, ${faker.string.alphanumeric(32)}) RETURNING *`;
      const counterfactualSafes = await Promise.all([
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '1')
            .build(),
        }),
        target.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: createCounterfactualSafeDtoBuilder()
            .with('chainId', '2')
            .build(),
        }),
      ]);

      // store data in the cache dirs
      const counterfactualSafesCacheDir = new CacheDir(
        `counterfactual_safes_${createAccountDto.address}`,
        faker.string.alpha(),
      );
      const counterfactualSafeCacheDirs = [
        new CacheDir(
          `counterfactual_safe_${counterfactualSafes[0].id}`,
          faker.string.alpha(),
        ),
        new CacheDir(
          `counterfactual_safe_${counterfactualSafes[1].id}`,
          faker.string.alpha(),
        ),
      ];

      await expect(
        target.deleteCounterfactualSafesForAccount(account),
      ).resolves.not.toThrow();

      // database is cleared
      const actual = await target.getCounterfactualSafesForAddress(
        createAccountDto.address,
      );
      expect(actual).toHaveLength(0);
      // cache is cleared
      expect(
        await fakeCacheService.hGet(counterfactualSafesCacheDir),
      ).toBeUndefined();
      expect(
        await fakeCacheService.hGet(counterfactualSafeCacheDirs[0]),
      ).toBeUndefined();
      expect(
        await fakeCacheService.hGet(counterfactualSafeCacheDirs[1]),
      ).toBeUndefined();
    });
  });
});
