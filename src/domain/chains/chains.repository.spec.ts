import { faker } from '@faker-js/faker/.';
import chunk from 'lodash/chunk';
import { getAddress } from 'viem';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockConfigApi = {
  getChains: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>;
const mockTransactionApiManager =
  {} as jest.MockedObjectDeep<ITransactionApiManager>;
const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

/**
 * Note: all other methods of the repository are tested in situ.
 * Whilst `getAllChains` is to some extent as well, the following
 * tests are required to cover all edge cases.
 */
describe('ChainsRepository', () => {
  // According to the limits of the Config Service
  // @see https://github.com/safe-global/safe-config-service/blob/main/src/chains/views.py#L14-L16
  const OFFSET = 40;
  const MAX_LIMIT = 40;

  let target: ChainsRepository;
  const maxSequentialPages = 3;

  beforeEach(() => {
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'safeConfig.chains.maxSequentialPages')
        return maxSequentialPages;
    });

    target = new ChainsRepository(
      mockLoggingService,
      mockConfigApi,
      mockTransactionApiManager,
      mockConfigurationService,
    );
  });

  it('should return all chains across pages below request limit', async () => {
    const url = faker.internet.url({ appendSlash: true });
    const chains = faker.helpers.multiple(
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
      {
        count: ChainsRepository.MAX_LIMIT * (maxSequentialPages - 1), // One page less than request limit
      },
    );
    const pages = chunk(chains, ChainsRepository.MAX_LIMIT).map(
      (results, i, arr) => {
        const pageOffset = (i + 1) * OFFSET;

        const previous = ((): string | null => {
          if (i === 0) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();
        const next = ((): string | null => {
          if (i === arr.length - 1) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();

        return rawify(
          pageBuilder<Chain>()
            .with('results', results)
            .with('count', chains.length)
            .with('previous', previous)
            .with('next', next)
            .build(),
        );
      },
    );
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Raw<Page<Chain>>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === OFFSET) {
          return Promise.resolve(pages[1]);
        }
        if (offset === OFFSET * 2) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains.map((chain) => {
        return {
          ...chain,
          ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
        };
      }),
    );
    expect(mockConfigApi.getChains).toHaveBeenCalledTimes(2);
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: MAX_LIMIT,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: MAX_LIMIT,
      offset: OFFSET,
    });
  });

  it('should return all chains across pages up request limit', async () => {
    const url = faker.internet.url({ appendSlash: true });
    const chains = faker.helpers.multiple(
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
      {
        count: ChainsRepository.MAX_LIMIT * maxSequentialPages, // Exactly request limit
      },
    );
    const pages = chunk(chains, ChainsRepository.MAX_LIMIT).map(
      (results, i, arr) => {
        const pageOffset = (i + 1) * OFFSET;

        const previous = ((): string | null => {
          if (i === 0) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();
        const next = ((): string | null => {
          if (i === arr.length - 1) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();

        return rawify(
          pageBuilder<Chain>()
            .with('results', results)
            .with('count', chains.length)
            .with('previous', previous)
            .with('next', next)
            .build(),
        );
      },
    );
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Raw<Page<Chain>>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === OFFSET) {
          return Promise.resolve(pages[1]);
        }
        if (offset === OFFSET * 2) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains.map((chain) => {
        return {
          ...chain,
          ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
        };
      }),
    );
    expect(mockConfigApi.getChains).toHaveBeenCalledTimes(3);
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: MAX_LIMIT,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: MAX_LIMIT,
      offset: OFFSET,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(3, {
      limit: MAX_LIMIT,
      offset: OFFSET * 2,
    });
  });

  it('should return all chains across pages up to request limit and notify if there are more', async () => {
    const url = faker.internet.url({ appendSlash: true });
    const chains = faker.helpers.multiple(
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
      {
        count: ChainsRepository.MAX_LIMIT * (maxSequentialPages + 1), // One page more than request limit
      },
    );
    const pages = chunk(chains, ChainsRepository.MAX_LIMIT).map(
      (results, i, arr) => {
        const pageOffset = (i + 1) * OFFSET;

        const previous = ((): string | null => {
          if (i === 0) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();
        const next = ((): string | null => {
          if (i === arr.length - 1) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();

        return rawify(
          pageBuilder<Chain>()
            .with('results', results)
            .with('count', chains.length)
            .with('previous', previous)
            .with('next', next)
            .build(),
        );
      },
    );
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Raw<Page<Chain>>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === OFFSET) {
          return Promise.resolve(pages[1]);
        }
        if (offset === OFFSET * 2) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains
        .slice(0, ChainsRepository.MAX_LIMIT * maxSequentialPages)
        .map((chain) => {
          return {
            ...chain,
            ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
          };
        }),
    );
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: MAX_LIMIT,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: MAX_LIMIT,
      offset: OFFSET,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(3, {
      limit: MAX_LIMIT,
      offset: OFFSET * 2,
    });
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenNthCalledWith(
      1,
      'More chains available despite request limit reached',
    );
  });
});
