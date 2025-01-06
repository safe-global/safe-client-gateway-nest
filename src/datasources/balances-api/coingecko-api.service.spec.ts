import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CoingeckoApi } from '@/datasources/balances-api/coingecko-api.service';
import { faker } from '@faker-js/faker';
import type { CacheFirstDataSource } from '../cache/cache.first.data.source';
import {
  AssetPricesSchema,
  type AssetPrice,
} from '@/datasources/balances-api/entities/asset-price.entity';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import sortBy from 'lodash/sortBy';
import type { ILoggingService } from '@/logging/logging.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pricesProviderBuilder } from '@/domain/chains/entities/__tests__/prices-provider.builder';
import { rawify } from '@/validation/entities/raw.entity';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

const mockCacheService = jest.mocked({
  deleteByKey: jest.fn(),
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('CoingeckoAPI', () => {
  let service: CoingeckoApi;
  let fakeConfigurationService: FakeConfigurationService;
  const coingeckoBaseUri = faker.internet.url({ appendSlash: false });
  const coingeckoApiKey = faker.string.sample();
  const pricesTtlSeconds = faker.number.int();
  const nativeCoinPricesTtlSeconds = faker.number.int();
  const highRefreshRateTokensTtlSeconds = faker.number.int();
  const notFoundPriceTtlSeconds = faker.number.int();
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.safe.prices.baseUri',
      coingeckoBaseUri,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.apiKey',
      coingeckoApiKey,
    );
    fakeConfigurationService.set(
      `balances.providers.safe.prices.highRefreshRateTokens`,
      [],
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.pricesTtlSeconds',
      pricesTtlSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.nativeCoinPricesTtlSeconds',
      nativeCoinPricesTtlSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.highRefreshRateTokensTtlSeconds',
      highRefreshRateTokensTtlSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.notFoundPriceTtlSeconds',
      notFoundPriceTtlSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );
  });

  it('should error if configuration is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();

    expect(
      () =>
        new CoingeckoApi(
          fakeConfigurationService,
          mockCacheFirstDataSource,
          mockNetworkService,
          mockCacheService,
          mockLoggingService,
        ),
    ).toThrow();
  });

  it('should return fiat codes (using an API key)', async () => {
    mockCacheFirstDataSource.get.mockResolvedValue(
      rawify(['usd', 'eur', 'eth']),
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toStrictEqual(['USD', 'EUR', 'ETH']);
    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir('safe_fiat_codes', ''),
      url: `${coingeckoBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return fiat codes (with no API key)', async () => {
    mockCacheFirstDataSource.get.mockResolvedValue(
      rawify(['usd', 'eur', 'eth']),
    );
    fakeConfigurationService.set('balances.providers.safe.prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toStrictEqual(['USD', 'EUR', 'ETH']);
    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir('safe_fiat_codes', ''),
      url: `${coingeckoBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {},
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return an empty array and log error if pricesProvider.chainName is not defined', async () => {
    const chain = chainBuilder()
      .with(
        'pricesProvider',
        pricesProviderBuilder().with('chainName', null).build(),
      )
      .build();
    const tokenAddresses = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const fiatCode = faker.finance.currencyCode();

    const result = await service.getTokenPrices({
      chain,
      tokenAddresses,
      fiatCode,
    });

    expect(result).toStrictEqual([]);
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `Error getting token prices: Error: pricesProvider.chainName is not defined `,
    );
  });

  it('should return and cache one token price (using an API key)', async () => {
    const chain = chainBuilder().build();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: { [lowerCaseFiatCode]: price },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([
      { [tokenAddress]: { [lowerCaseFiatCode]: price } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: lowerCaseFiatCode,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({ [tokenAddress]: { [lowerCaseFiatCode]: price } }),
      pricesTtlSeconds,
    );
  });

  it('should return and cache one token price (with no API key)', async () => {
    fakeConfigurationService.set('balances.providers.safe.prices.apiKey', null);
    const chain = chainBuilder().build();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: { [lowerCaseFiatCode]: price },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([
      { [tokenAddress]: { [lowerCaseFiatCode]: price } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: lowerCaseFiatCode,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({ [tokenAddress]: { [lowerCaseFiatCode]: price } }),
      pricesTtlSeconds,
    );
  });

  it('should return and cache multiple token prices', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      { [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice } },
      { [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice } },
      { [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [
            firstTokenAddress,
            secondTokenAddress,
            thirdTokenAddress,
          ].join(','),
          vs_currencies: lowerCaseFiatCode,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      }),
      pricesTtlSeconds,
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      }),
      pricesTtlSeconds,
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
      }),
      pricesTtlSeconds,
    );
  });

  it('should return and cache with low TTL one high-refresh-rate token price', async () => {
    const chain = chainBuilder().build();
    const highRefreshRateTokenAddress = faker.finance.ethereumAddress();
    const anotherTokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const anotherPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [highRefreshRateTokenAddress]: { [lowerCaseFiatCode]: price },
      [anotherTokenAddress]: { [lowerCaseFiatCode]: anotherPrice },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });
    fakeConfigurationService.set(
      `balances.providers.safe.prices.highRefreshRateTokens`,
      [
        faker.finance.ethereumAddress(),
        highRefreshRateTokenAddress.toUpperCase(), // to check this configuration is case insensitive
        faker.finance.ethereumAddress(),
      ],
    );
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [highRefreshRateTokenAddress, anotherTokenAddress],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      { [highRefreshRateTokenAddress]: { [lowerCaseFiatCode]: price } },
      { [anotherTokenAddress]: { [lowerCaseFiatCode]: anotherPrice } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [
            highRefreshRateTokenAddress,
            anotherTokenAddress,
          ].join(','),
          vs_currencies: lowerCaseFiatCode,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(2);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);
    // high-refresh-rate token price is cached with highRefreshRateTokensTtlSeconds
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${highRefreshRateTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${highRefreshRateTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [highRefreshRateTokenAddress]: { [lowerCaseFiatCode]: price },
      }),
      highRefreshRateTokensTtlSeconds,
    );
    // another token price is cached with pricesCacheTtlSeconds
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${anotherTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${anotherTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [anotherTokenAddress]: { [lowerCaseFiatCode]: anotherPrice },
      }),
      pricesTtlSeconds,
    );
  });

  it('should cache new token prices only', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
    };
    mockCacheService.hGet.mockResolvedValueOnce(undefined);
    mockCacheService.hGet.mockResolvedValueOnce(
      JSON.stringify({
        [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      }),
    );
    mockCacheService.hGet.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrices = await service
      .getTokenPrices({
        chain,
        tokenAddresses: [
          firstTokenAddress,
          secondTokenAddress,
          thirdTokenAddress,
        ],
        fiatCode,
      })
      .then(AssetPricesSchema.parse);

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          { [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice } },
          { [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice } },
          { [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice } },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [firstTokenAddress, thirdTokenAddress].join(','),
          vs_currencies: lowerCaseFiatCode,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);
    expect(mockCacheService.hSet).toHaveBeenNthCalledWith(
      1,
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      }),
      pricesTtlSeconds,
    );
    expect(mockCacheService.hSet).toHaveBeenNthCalledWith(
      2,
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
      }),
      pricesTtlSeconds,
    );
  });

  it('should cache not found token prices with an extended TTL', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
    };
    mockCacheService.hGet.mockResolvedValueOnce(
      JSON.stringify({ [firstTokenAddress]: { [lowerCaseFiatCode]: null } }),
    );
    mockCacheService.hGet.mockResolvedValueOnce(
      JSON.stringify({
        [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      }),
    );
    mockCacheService.hGet.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrices = await service
      .getTokenPrices({
        chain,
        tokenAddresses: [
          firstTokenAddress,
          secondTokenAddress,
          thirdTokenAddress,
        ],
        fiatCode,
      })
      .then(AssetPricesSchema.parse);

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          { [firstTokenAddress]: { [lowerCaseFiatCode]: null } },
          { [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice } },
          { [thirdTokenAddress]: { [lowerCaseFiatCode]: null } },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: thirdTokenAddress,
          vs_currencies: lowerCaseFiatCode,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet.mock.calls[0][1]).toEqual(
      JSON.stringify({ [thirdTokenAddress]: { [lowerCaseFiatCode]: null } }),
    );
    expect(mockCacheService.hSet.mock.calls[0][2]).toBeGreaterThanOrEqual(
      fakeConfigurationService.get(
        'balances.providers.safe.prices.notFoundPriceTtlSeconds',
      ) as number,
    );
    expect(mockCacheService.hSet.mock.calls[0][2]).toBeLessThanOrEqual(
      (fakeConfigurationService.get(
        'balances.providers.safe.prices.notFoundPriceTtlSeconds',
      ) as number) + CoingeckoApi.NOT_FOUND_TTL_RANGE_SECONDS,
    );
  });

  it('should return the native coin price (using an API key)', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(rawify(expectedAssetPrice));

    await service.getNativeCoinPrice({ chain, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir(
        `${chain.pricesProvider.nativeCoin}_native_coin_price_${lowerCaseFiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: lowerCaseFiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: nativeCoinPricesTtlSeconds,
    });
  });

  it('should return the native coin price (with no API key)', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(rawify(expectedAssetPrice));
    fakeConfigurationService.set('balances.providers.safe.prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    await service.getNativeCoinPrice({ chain, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir(
        `${chain.pricesProvider.nativeCoin}_native_coin_price_${lowerCaseFiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: lowerCaseFiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: nativeCoinPricesTtlSeconds,
    });
  });

  it('should return null and log error if pricesProvider.nativeCoin is not defined', async () => {
    const chain = chainBuilder()
      .with(
        'pricesProvider',
        pricesProviderBuilder().with('nativeCoin', null).build(),
      )
      .build();
    const fiatCode = faker.finance.currencyCode();

    const result = await service.getNativeCoinPrice({ chain, fiatCode });

    expect(result).toBeNull();
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `Error getting native coin price: Error: pricesProvider.nativeCoinId is not defined `,
    );
  });
});
