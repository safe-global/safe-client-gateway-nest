import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { dedicatedStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { defiVaultStatsBuilder } from '@/datasources/staking-api/entities/__tests__/defi-vault-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { pooledStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/pooled-staking-stats.entity.builder';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import { transactionStatusBuilder } from '@/datasources/staking-api/entities/__tests__/transaction-status.entity.builder';
import { KilnApi } from '@/datasources/staking-api/kiln-api.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const dataSource = {
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>;
const mockDataSource = jest.mocked(dataSource);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

const cacheService = {
  deleteByKey: jest.fn(),
  hSet: jest.fn(),
  hGet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>;
const mockCacheService = jest.mocked(cacheService);

describe('KilnApi', () => {
  let target: KilnApi;

  let chainId: string;
  let baseUrl: string;
  let apiKey: string;
  let httpErrorFactory: HttpErrorFactory;
  let stakingExpirationTimeInSeconds: number;
  let notFoundExpireTimeSeconds: number;

  function createTarget(_chainId = faker.string.numeric()): void {
    chainId = _chainId;
    baseUrl = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.hexadecimal({ length: 32 });
    httpErrorFactory = new HttpErrorFactory();
    stakingExpirationTimeInSeconds = faker.number.int();
    notFoundExpireTimeSeconds = faker.number.int();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.staking') {
        return stakingExpirationTimeInSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.default') {
        return notFoundExpireTimeSeconds;
      }
      throw Error(`Unexpected key: ${key}`);
    });

    target = new KilnApi(
      baseUrl,
      apiKey,
      mockDataSource,
      httpErrorFactory,
      mockConfigurationService,
      mockCacheService,
      chainId,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    createTarget();
  });

  describe('getDeployments', () => {
    it('should return deployments', async () => {
      const deployments = faker.helpers.multiple(
        () => deploymentBuilder().build(),
        { count: { min: 1, max: 5 } },
      );
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: deployments,
        }),
      );

      const actual = await target.getDeployments();

      expect(actual).toBe(deployments);
      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir('staking_deployments', ''),
        url: `${baseUrl}/v1/deployments`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should forward errors', async () => {
      const getDeploymentsUrl = `${baseUrl}/v1/deployments`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDeploymentsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );

      await expect(target.getDeployments()).rejects.toThrow(expected);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir('staking_deployments', ''),
        url: `${baseUrl}/v1/deployments`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });

  describe('getNetworkStats', () => {
    it('should return network stats', async () => {
      const networkStats = networkStatsBuilder().build();
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: networkStats,
        }),
      );

      const actual = await target.getNetworkStats();

      expect(actual).toBe(networkStats);
      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir('staking_network_stats', ''),
        url: `${baseUrl}/v1/eth/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should forward errors', async () => {
      const getNetworkStatsUrl = `${baseUrl}/v1/eth/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getNetworkStatsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );

      await expect(target.getNetworkStats()).rejects.toThrow(expected);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir('staking_network_stats', ''),
        url: `${baseUrl}/v1/eth/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });

  describe('getDedicatedStakingStats', () => {
    it('should return the dedicated staking stats', async () => {
      const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: dedicatedStakingStats,
        }),
      );

      const actual = await target.getDedicatedStakingStats();

      expect(actual).toBe(dedicatedStakingStats);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir('staking_dedicated_staking_stats', ''),
        url: `${baseUrl}/v1/eth/kiln-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should forward errors', async () => {
      const getDedicatedStakingStats = `${baseUrl}/v1/eth/kiln-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDedicatedStakingStats),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(target.getDedicatedStakingStats()).rejects.toThrow(expected);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir('staking_dedicated_staking_stats', ''),
        url: getDedicatedStakingStats,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });

  describe('getPooledStakingStats', () => {
    it('should return the pooled staking integration', async () => {
      const pooledStakingStats = pooledStakingStatsBuilder().build();
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: pooledStakingStats,
        }),
      );

      const actual = await target.getPooledStakingStats(
        pooledStakingStats.address,
      );

      expect(actual).toBe(pooledStakingStats);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir(
          `staking_pooled_staking_stats_${pooledStakingStats.address}`,
          '',
        ),
        url: `${baseUrl}/v1/eth/onchain/v2/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            integration: pooledStakingStats.address,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should forward errors', async () => {
      const pooledStakingStats = pooledStakingStatsBuilder().build();
      const getPooledStakingStatsUrl = `${baseUrl}/v1/eth/onchain/v2/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getPooledStakingStatsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(
        target.getPooledStakingStats(pooledStakingStats.address),
      ).rejects.toThrow(expected);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir(
          `staking_pooled_staking_stats_${pooledStakingStats.address}`,
          '',
        ),
        url: `${baseUrl}/v1/eth/onchain/v2/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            integration: pooledStakingStats.address,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });

  describe('getDefiVaultStats', () => {
    it('should return the defi vault stats', async () => {
      const chainIds = {
        eth: 1,
        arb: 42161,
        bsc: 56,
        matic: 137,
        op: 10,
      };
      const [chain, chain_id] = faker.helpers.arrayElement(
        Object.entries(chainIds) as Array<[keyof typeof chainIds, number]>,
      );
      // Ensure target is created with supported chain
      createTarget(chain_id.toString());
      const defiVaultStats = defiVaultStatsBuilder()
        .with('chain', chain)
        .with('chain_id', chain_id)
        .build();
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: [defiVaultStats],
        }),
      );

      const actual = await target.getDefiVaultStats(defiVaultStats.vault);

      expect(actual).toStrictEqual([defiVaultStats]);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir(
          `${defiVaultStats.chain_id.toString()}_staking_defi_vault_stats_${defiVaultStats.vault}`,
          '',
        ),
        url: `${baseUrl}/v1/defi/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            vaults: `${defiVaultStats.chain}_${defiVaultStats.vault}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should throw if the chainId is not supported by Kiln', async () => {
      // Not Ethereum (1) or Optimism (10)
      const chainId = faker.number.int({ min: 2, max: 9 });
      // Ensure target is created with unsupported chain
      createTarget(chainId.toString());
      const defiVaultStats = defiVaultStatsBuilder()
        .with('chain_id', chainId)
        .build();

      await expect(
        target.getDefiVaultStats(defiVaultStats.vault),
      ).rejects.toThrow();

      expect(dataSource.get).not.toHaveBeenCalled();
    });

    it('should forward errors', async () => {
      const chainIds = {
        eth: 1,
        arb: 42161,
        bsc: 56,
        matic: 137,
        op: 10,
      };
      const [chain, chain_id] = faker.helpers.arrayElement(
        Object.entries(chainIds) as Array<[keyof typeof chainIds, number]>,
      );
      // Ensure target is created with supported chain
      createTarget(chain_id.toString());
      const defiVaultStats = defiVaultStatsBuilder()
        .with('chain', chain)
        .with('chain_id', chain_id)
        .build();
      const getDefiVaultStatsUrl = `${baseUrl}/v1/defi/network-stats`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDefiVaultStatsUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(
        target.getDefiVaultStats(defiVaultStats.vault),
      ).rejects.toThrow(expected);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: new CacheDir(
          `${defiVaultStats.chain_id.toString()}_staking_defi_vault_stats_${defiVaultStats.vault}`,
          '',
        ),
        url: `${baseUrl}/v1/defi/network-stats`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            vaults: `${defiVaultStats.chain}_${defiVaultStats.vault}`,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });

  describe('getStakes', () => {
    it('should return stakes', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const validatorsPublicKeys = faker.helpers.multiple(
        () =>
          faker.string.hexadecimal({
            length: KilnDecoder.KilnPublicKeyLength,
          }) as `0x${string}`,
        { count: { min: 1, max: 5 } },
      );
      const concatenatedValidatorsPublicKeys = validatorsPublicKeys.join(',');
      const stakes = faker.helpers.multiple(() => stakeBuilder().build(), {
        count: validatorsPublicKeys.length,
      });
      const getStakesUrl = `${baseUrl}/v1/eth/stakes`;
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: stakes,
        }),
      );

      const actual = await target.getStakes({
        safeAddress,
        validatorsPublicKeys,
      });

      expect(actual).toBe(stakes);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: CacheRouter.getStakingStakesCacheDir({
          chainId,
          safeAddress,
          validatorsPublicKeys,
        }),
        url: getStakesUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            onchain_v1_include_net_rewards: true,
            validators: concatenatedValidatorsPublicKeys,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should forward errors', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const validatorsPublicKeys = faker.helpers.multiple(
        () =>
          faker.string.hexadecimal({
            length: KilnDecoder.KilnPublicKeyLength,
          }) as `0x${string}`,
        { count: { min: 1, max: 5 } },
      );
      const concatenatedValidatorsPublicKeys = validatorsPublicKeys.join(',');
      const getStakesUrl = `${baseUrl}/v1/eth/stakes`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getStakesUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(
        target.getStakes({
          safeAddress,
          validatorsPublicKeys,
        }),
      ).rejects.toThrow(expected);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: CacheRouter.getStakingStakesCacheDir({
          chainId,
          safeAddress,
          validatorsPublicKeys,
        }),
        url: getStakesUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            onchain_v1_include_net_rewards: true,
            validators: concatenatedValidatorsPublicKeys,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });

  describe('clearStakes', () => {
    it('should clear Safe stakes cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await target.clearStakes(safeAddress);

      expect(cacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(cacheService.deleteByKey).toHaveBeenNthCalledWith(
        1,
        `${chainId}_staking_stakes_${safeAddress}`,
      );
    });
  });

  describe('getTransactionStatus', () => {
    it('should return the transaction status', async () => {
      const txHash = faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      const transactionStatus = transactionStatusBuilder().build();
      const getTransactionStatusUrl = `${baseUrl}/v1/eth/transaction/status`;
      dataSource.get.mockResolvedValue(
        rawify({
          status: 200,
          // Note: Kiln always return { data: T }
          data: transactionStatus,
        }),
      );

      const actual = await target.getTransactionStatus(txHash);

      expect(actual).toBe(transactionStatus);

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: CacheRouter.getStakingTransactionStatusCacheDir({
          chainId,
          txHash,
        }),
        url: getTransactionStatusUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            tx_hash: txHash,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });

    it('should forward errors', async () => {
      const txHash = faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      const getTransactionStatusUrl = `${baseUrl}/v1/eth/transaction/status`;
      const errorMessage = faker.lorem.sentence();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      dataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getTransactionStatusUrl),
          {
            status: statusCode,
          } as Response,
          new Error(errorMessage),
        ),
      );
      await expect(target.getTransactionStatus(txHash)).rejects.toThrow(
        expected,
      );

      expect(dataSource.get).toHaveBeenCalledTimes(1);
      expect(dataSource.get).toHaveBeenNthCalledWith(1, {
        cacheDir: CacheRouter.getStakingTransactionStatusCacheDir({
          chainId,
          txHash,
        }),
        url: getTransactionStatusUrl,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            tx_hash: txHash,
          },
        },
        expireTimeSeconds: stakingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      });
    });
  });
});
