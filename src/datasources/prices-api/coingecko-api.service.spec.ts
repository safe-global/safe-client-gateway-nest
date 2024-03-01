import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CoingeckoApi } from '@/datasources/prices-api/coingecko-api.service';
import { faker } from '@faker-js/faker';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { sortBy } from 'lodash';
import { ILoggingService } from '@/logging/logging.interface';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as unknown as CacheFirstDataSource);

const mockCacheService = jest.mocked({
  deleteByKey: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
} as unknown as ICacheService);

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as unknown as INetworkService);

const mockLoggingService = {
  debug: jest.fn(),
} as unknown as ILoggingService;

describe('CoingeckoAPI', () => {
  let service: CoingeckoApi;
  let fakeConfigurationService: FakeConfigurationService;
  const coingeckoBaseUri = faker.internet.url({ appendSlash: false });
  const coingeckoApiKey = faker.string.sample();
  const pricesCacheTtlSeconds = faker.number.int();
  const notFoundPriceTtlSeconds = faker.number.int();
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('prices.baseUri', coingeckoBaseUri);
    fakeConfigurationService.set('prices.apiKey', coingeckoApiKey);
    fakeConfigurationService.set(
      'prices.pricesTtlSeconds',
      pricesCacheTtlSeconds,
    );
    fakeConfigurationService.set(
      'prices.notFoundPriceTtlSeconds',
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

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
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
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir('fiat_codes', ''),
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
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir('fiat_codes', ''),
      url: `${coingeckoBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {},
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return and cache one token price (using an API key)', async () => {
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const price = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: { [fiatCode]: price },
    };
    mockCacheService.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chainName,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chainName}_token_price_${tokenAddress}_${fiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([{ [tokenAddress]: { [fiatCode]: price } }]);
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: fiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(1);
    expect(mockCacheService.get).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({ [tokenAddress]: { [fiatCode]: price } }),
      pricesCacheTtlSeconds,
    );
  });

  it('should return and cache one token price (with no API key)', async () => {
    fakeConfigurationService.set('prices.apiKey', null);
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const price = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: { [fiatCode]: price },
    };
    mockCacheService.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
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
      chainName,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chainName}_token_price_${tokenAddress}_${fiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([{ [tokenAddress]: { [fiatCode]: price } }]);
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: fiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(1);
    expect(mockCacheService.get).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({ [tokenAddress]: { [fiatCode]: price } }),
      pricesCacheTtlSeconds,
    );
  });

  it('should return and cache multiple token prices', async () => {
    const chainName = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: { [fiatCode]: firstPrice },
      [secondTokenAddress]: { [fiatCode]: secondPrice },
      [thirdTokenAddress]: { [fiatCode]: thirdPrice },
    };
    mockCacheService.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chainName,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      { [firstTokenAddress]: { [fiatCode]: firstPrice } },
      { [secondTokenAddress]: { [fiatCode]: secondPrice } },
      { [thirdTokenAddress]: { [fiatCode]: thirdPrice } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [
            firstTokenAddress,
            secondTokenAddress,
            thirdTokenAddress,
          ].join(','),
          vs_currencies: fiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(3);
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(3);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${fiatCode}`,
        '',
      ),
      JSON.stringify({ [firstTokenAddress]: { [fiatCode]: firstPrice } }),
      pricesCacheTtlSeconds,
    );
    expect(mockCacheService.set).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${fiatCode}`,
        '',
      ),
      JSON.stringify({ [secondTokenAddress]: { [fiatCode]: secondPrice } }),
      pricesCacheTtlSeconds,
    );
    expect(mockCacheService.set).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${fiatCode}`,
        '',
      ),
      JSON.stringify({ [thirdTokenAddress]: { [fiatCode]: thirdPrice } }),
      pricesCacheTtlSeconds,
    );
  });

  it('should cache new token prices only', async () => {
    const chainName = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: { [fiatCode]: firstPrice },
      [thirdTokenAddress]: { [fiatCode]: thirdPrice },
    };
    mockCacheService.get.mockResolvedValueOnce(undefined);
    mockCacheService.get.mockResolvedValueOnce(
      JSON.stringify({ [secondTokenAddress]: { [fiatCode]: secondPrice } }),
    );
    mockCacheService.get.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });

    const assetPrices = await service.getTokenPrices({
      chainName,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          { [firstTokenAddress]: { [fiatCode]: firstPrice } },
          { [secondTokenAddress]: { [fiatCode]: secondPrice } },
          { [thirdTokenAddress]: { [fiatCode]: thirdPrice } },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [firstTokenAddress, thirdTokenAddress].join(','),
          vs_currencies: fiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(3);
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(2);
    expect(mockCacheService.set).toHaveBeenNthCalledWith(
      1,
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${fiatCode}`,
        '',
      ),
      JSON.stringify({ [firstTokenAddress]: { [fiatCode]: firstPrice } }),
      pricesCacheTtlSeconds,
    );
    expect(mockCacheService.set).toHaveBeenNthCalledWith(
      2,
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${fiatCode}`,
        '',
      ),
      JSON.stringify({ [thirdTokenAddress]: { [fiatCode]: thirdPrice } }),
      pricesCacheTtlSeconds,
    );
  });

  it('should cache not found token prices with an extended TTL', async () => {
    const chainName = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: { [fiatCode]: firstPrice },
    };
    mockCacheService.get.mockResolvedValueOnce(
      JSON.stringify({ [firstTokenAddress]: { [fiatCode]: null } }),
    );
    mockCacheService.get.mockResolvedValueOnce(
      JSON.stringify({ [secondTokenAddress]: { [fiatCode]: secondPrice } }),
    );
    mockCacheService.get.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });

    const assetPrices = await service.getTokenPrices({
      chainName,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          { [firstTokenAddress]: { [fiatCode]: null } },
          { [secondTokenAddress]: { [fiatCode]: secondPrice } },
          { [thirdTokenAddress]: { [fiatCode]: null } },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: thirdTokenAddress,
          vs_currencies: fiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(3);
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${fiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set.mock.calls[0][1]).toEqual(
      JSON.stringify({ [thirdTokenAddress]: { [fiatCode]: null } }),
    );
    expect(mockCacheService.set.mock.calls[0][2]).toBeGreaterThanOrEqual(
      (fakeConfigurationService.get(
        'prices.notFoundPriceTtlSeconds',
      ) as number) - CoingeckoApi.notFoundTtlRangeSeconds,
    );
    expect(mockCacheService.set.mock.calls[0][2]).toBeLessThanOrEqual(
      (fakeConfigurationService.get(
        'prices.notFoundPriceTtlSeconds',
      ) as number) + CoingeckoApi.notFoundTtlRangeSeconds,
    );
  });

  it('should return the native coin price (using an API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir(
        `${nativeCoinId}_native_coin_price_${fiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          ids: nativeCoinId,
          vs_currencies: fiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the native coin price (with no API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir(
        `${nativeCoinId}_native_coin_price_${fiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        params: {
          ids: nativeCoinId,
          vs_currencies: fiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });
});
