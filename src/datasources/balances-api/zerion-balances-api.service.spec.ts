import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionBalancesApi } from '@/datasources/balances-api/zerion-balances-api.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { balancesProviderBuilder } from '@/domain/chains/entities/__tests__/balances-provider.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const mockCacheService = jest.mocked({
  increment: jest.fn(),
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockHttpErrorFactory = jest.mocked({
  from: jest.fn(),
} as jest.MockedObjectDeep<HttpErrorFactory>);

describe('ZerionBalancesApiService', () => {
  let service: ZerionBalancesApi;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();
  const supportedFiatCodes = Array.from(
    new Set([
      ...faker.helpers.multiple(
        () => faker.finance.currencyCode().toLowerCase(),
        { count: { min: 2, max: 5 } },
      ),
    ]),
  );
  const fallbackChainId = faker.number.int();
  const fallbackChainName = faker.string.sample();
  const fallbackChainsConfiguration = {
    [fallbackChainId]: { chainName: fallbackChainName },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.apiKey',
      zerionApiKey,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.baseUri',
      zerionBaseUri,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.chains',
      fallbackChainsConfiguration,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.currencies',
      supportedFiatCodes,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.limitPeriodSeconds',
      faker.number.int(),
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.limitCalls',
      faker.number.int(),
    );

    service = new ZerionBalancesApi(
      mockCacheService,
      mockLoggingService,
      mockNetworkService,
      fakeConfigurationService,
      mockHttpErrorFactory,
    );
  });

  describe('getBalances', () => {
    it('should fail for an invalid fiatCode', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.string.alphanumeric({
        exclude: supportedFiatCodes,
      });

      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toThrow(`Unsupported currency code: ${fiatCode}`);
    });

    it('should get the chainName from the chain parameter', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        networkRequest: {
          headers: { Authorization: `Basic ${zerionApiKey}` },
          params: {
            'filter[chain_ids]': chain.balancesProvider.chainName,
            currency: fiatCode.toLowerCase(),
            sort: 'value',
          },
        },
      });
    });

    it('should fallback to the static configuration to get the chainName', async () => {
      const chain = chainBuilder()
        .with('chainId', fallbackChainId.toString())
        .with(
          'balancesProvider',
          balancesProviderBuilder().with('chainName', null).build(),
        )
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        networkRequest: {
          headers: { Authorization: `Basic ${zerionApiKey}` },
          params: {
            'filter[chain_ids]': fallbackChainName,
            currency: fiatCode.toLowerCase(),
            sort: 'value',
          },
        },
      });
    });
  });
});
