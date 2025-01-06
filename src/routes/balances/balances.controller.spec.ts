import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pricesProviderBuilder } from '@/domain/chains/entities/__tests__/prices-provider.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { getAddress } from 'viem';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let pricesProviderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        counterfactualBalances: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    pricesProviderUrl = configurationService.getOrThrow(
      'balances.providers.safe.prices.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /balances', () => {
    it(`maps native coin + ERC20 token balance correctly, and sorts balances by fiatBalance`, async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const tokenAddress = faker.finance.ethereumAddress();
      const secondTokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const apiKey = app
        .get<IConfigurationService>(IConfigurationService)
        .getOrThrow('balances.providers.safe.prices.apiKey');
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress]: { [currency.toLowerCase()]: 10 },
      };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          case `${pricesProviderUrl}/simple/price`:
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`:
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${
            chain.chainId
          }/safes/${safeAddress}/balances/${currency.toUpperCase()}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '5410.25',
          items: [
            {
              tokenInfo: {
                type: 'NATIVE_TOKEN',
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                symbol: chain.nativeCurrency.symbol,
                name: chain.nativeCurrency.name,
                logoUri: chain.nativeCurrency.logoUri,
              },
              balance: '3000000000000000000',
              fiatBalance: '4610.25',
              fiatConversion: '1536.75',
            },
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[1].tokenAddress
                  ? getAddress(transactionApiBalancesResponse[1].tokenAddress)
                  : transactionApiBalancesResponse[1].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[1].token?.symbol,
                name: transactionApiBalancesResponse[1].token?.name,
                logoUri: transactionApiBalancesResponse[1].token?.logoUri,
              },
              balance: '4000000000000000000',
              fiatBalance: '500',
              fiatConversion: '12.5',
            },
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[2].tokenAddress
                  ? getAddress(transactionApiBalancesResponse[2].tokenAddress)
                  : transactionApiBalancesResponse[2].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[2].token?.symbol,
                name: transactionApiBalancesResponse[2].token?.name,
                logoUri: transactionApiBalancesResponse[2].token?.logoUri,
              },
              balance: '3000000000000000000',
              fiatBalance: '300',
              fiatConversion: '10',
            },
          ],
        });

      // 4 Network calls are expected
      // (1. Chain data, 2. Safe data, 3. Balances, 4. Coingecko native coin, 5. Coingecko tokens)
      expect(networkService.get.mock.calls.length).toBe(5);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      );
      expect(networkService.get.mock.calls[2][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': apiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': apiKey },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: currency.toLowerCase(),
        },
      });
    });

    it(`excludeSpam and trusted params are forwarded to tx service`, async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const excludeSpam = true;
      const trusted = true;
      const currency = faker.finance.currencyCode();
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 2.5 },
      };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`:
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}/?trusted=${trusted}&exclude_spam=${excludeSpam}`,
        )
        .expect(200);

      // trusted and exclude_spam params are passed
      expect(networkService.get.mock.calls[2][0].networkRequest).toStrictEqual({
        params: {
          trusted,
          exclude_spam: excludeSpam,
        },
      });
    });

    it(`maps native token correctly`, async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          case `${pricesProviderUrl}/simple/price`:
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${
            chain.chainId
          }/safes/${safeAddress}/balances/${currency.toUpperCase()}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '4610.25',
          items: [
            {
              tokenInfo: {
                type: 'NATIVE_TOKEN',
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                symbol: chain.nativeCurrency.symbol,
                name: chain.nativeCurrency.name,
                logoUri: chain.nativeCurrency.logoUri,
              },
              balance: '3000000000000000000',
              fiatBalance: '4610.25',
              fiatConversion: '1536.75',
            },
          ],
        });
    });

    it(`should map the native coin price to 0 when pricesProvider.nativeCoin is not set`, async () => {
      const chain = chainBuilder()
        .with('chainId', '10')
        .with(
          'pricesProvider',
          pricesProviderBuilder().with('nativeCoin', null).build(),
        )
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${
            chain.chainId
          }/safes/${safeAddress}/balances/${currency.toUpperCase()}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '0',
          items: [
            {
              tokenInfo: {
                type: 'NATIVE_TOKEN',
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                symbol: chain.nativeCurrency.symbol,
                name: chain.nativeCurrency.name,
                logoUri: chain.nativeCurrency.logoUri,
              },
              balance: '3000000000000000000',
              fiatBalance: '0',
              fiatConversion: '0',
            },
          ],
        });
    });

    it(`should map ERC20 tokens price to 0 when pricesProvider.chainName is not set`, async () => {
      const chain = chainBuilder()
        .with('chainId', '10')
        .with(
          'pricesProvider',
          pricesProviderBuilder().with('chainName', null).build(),
        )
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${
            chain.chainId
          }/safes/${safeAddress}/balances/${currency.toUpperCase()}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '0',
          items: [
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[0].tokenAddress
                  ? getAddress(transactionApiBalancesResponse[0].tokenAddress)
                  : transactionApiBalancesResponse[0].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[0].token?.symbol,
                name: transactionApiBalancesResponse[0].token?.name,
                logoUri: transactionApiBalancesResponse[0].token?.logoUri,
              },
              balance: '3000000000000000000',
              fiatBalance: '0',
              fiatConversion: '0',
            },
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[1].tokenAddress
                  ? getAddress(transactionApiBalancesResponse[1].tokenAddress)
                  : transactionApiBalancesResponse[1].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[1].token?.symbol,
                name: transactionApiBalancesResponse[1].token?.name,
                logoUri: transactionApiBalancesResponse[1].token?.logoUri,
              },
              balance: '3000000000000000000',
              fiatBalance: '0',
              fiatConversion: '0',
            },
          ],
        });
    });

    it('returns large numbers as is (not in scientific notation)', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '40000000000000000000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 2.5 },
      };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`:
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
        )
        .expect(200)
        .expect({
          fiatTotal: '1000000000000000000',
          items: [
            {
              tokenInfo: {
                type: 'ERC20',
                address: transactionApiBalancesResponse[0].tokenAddress
                  ? getAddress(transactionApiBalancesResponse[0].tokenAddress)
                  : transactionApiBalancesResponse[0].tokenAddress,
                decimals: 17,
                symbol: transactionApiBalancesResponse[0].token?.symbol,
                name: transactionApiBalancesResponse[0].token?.name,
                logoUri: transactionApiBalancesResponse[0].token?.logoUri,
              },
              balance: '40000000000000000000000000000000000',
              fiatBalance: '1000000000000000000',
              fiatConversion: '2.5',
            },
          ],
        });

      // 3 Network calls are expected
      // (1. Chain data, 2. Safe data, 3. Balances, 4. Coingecko token)
      expect(networkService.get.mock.calls.length).toBe(4);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      );
      expect(networkService.get.mock.calls[2][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`,
      );
    });

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const error = new NetworkResponseError(
          new URL(
            `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`,
          ),
          {
            status: 500,
          } as Response,
        );
        networkService.get.mockImplementation(() => Promise.reject(error));

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });

        expect(networkService.get.mock.calls.length).toBe(1);
      });
    });

    describe('Prices provider API Error', () => {
      it(`should return a 0-balance when an error is thrown by the provider`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const tokenAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('tokenAddress', getAddress(tokenAddress))
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              return Promise.resolve({
                data: rawify(safeBuilder().build()),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({
                data: rawify(transactionApiBalancesResponse),
                status: 200,
              });
            case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`:
              return Promise.reject();
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${
              chain.chainId
            }/safes/${safeAddress}/balances/${faker.finance.currencyCode()}`,
          )
          .expect(200)
          .expect({
            fiatTotal: '0',
            items: [
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: transactionApiBalancesResponse[0].tokenAddress
                    ? getAddress(transactionApiBalancesResponse[0].tokenAddress)
                    : transactionApiBalancesResponse[0].tokenAddress,
                  decimals: 17,
                  symbol: transactionApiBalancesResponse[0].token?.symbol,
                  name: transactionApiBalancesResponse[0].token?.name,
                  logoUri: transactionApiBalancesResponse[0].token?.logoUri,
                },
                balance: '40000000000000000000000000000000000',
                fiatBalance: '0',
                fiatConversion: '0',
              },
            ],
          });

        expect(networkService.get.mock.calls.length).toBe(4);
      });

      it(`should return a 0-balance when a validation error happens`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const tokenAddress = getAddress(faker.finance.ethereumAddress());
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const tokenPriceProviderResponse = 'notAnObject';
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              return Promise.resolve({
                data: rawify(safeBuilder().build()),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({
                data: rawify(transactionApiBalancesResponse),
                status: 200,
              });
            case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`:
              return Promise.resolve({
                data: rawify(tokenPriceProviderResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${
              chain.chainId
            }/safes/${safeAddress}/balances/${faker.finance.currencyCode()}`,
          )
          .expect(200)
          .expect({
            fiatTotal: '0',
            items: [
              {
                tokenInfo: {
                  type: 'ERC20',
                  address: transactionApiBalancesResponse[0].tokenAddress
                    ? getAddress(transactionApiBalancesResponse[0].tokenAddress)
                    : transactionApiBalancesResponse[0].tokenAddress,
                  decimals: 17,
                  symbol: transactionApiBalancesResponse[0].token?.symbol,
                  name: transactionApiBalancesResponse[0].token?.name,
                  logoUri: transactionApiBalancesResponse[0].token?.logoUri,
                },
                balance: '40000000000000000000000000000000000',
                fiatBalance: '0',
                fiatConversion: '0',
              },
            ],
          });

        expect(networkService.get.mock.calls.length).toBe(4);
      });
    });

    describe('Transaction API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        const transactionServiceUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/`;
        networkService.get.mockImplementation(({ url }) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
          ) {
            return Promise.resolve({
              data: rawify(safeBuilder().build()),
              status: 200,
            });
          } else if (url == transactionServiceUrl) {
            const error = new NetworkResponseError(
              new URL(transactionServiceUrl),
              {
                status: 500,
              } as Response,
            );
            return Promise.reject(error);
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });

        expect(networkService.get.mock.calls.length).toBe(3);
      });
    });

    it(`502 error if validation fails`, async () => {
      const chainId = '1';
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      networkService.get.mockImplementation(({ url }) => {
        if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
          return Promise.resolve({ data: rawify(chainResponse), status: 200 });
        } else if (
          url ==
          `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/`
        ) {
          return Promise.resolve({
            data: rawify([{ invalid: 'data' }]),
            status: 200,
          });
        } else if (
          url ==
          `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`
        ) {
          return Promise.resolve({
            data: rawify(safeBuilder().build()),
            status: 200,
          });
        } else {
          return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
        .expect(502)
        .expect({
          statusCode: 502,
          message: 'Bad gateway',
        });

      expect(networkService.get.mock.calls.length).toBe(3);
    });
  });

  describe('GET /balances/supported-fiat-codes', () => {
    it("should return the ordered list of supported fiat codes (assuming provider's response contains uppercase codes)", async () => {
      const chain = chainBuilder().build();
      // So BalancesApiManager available currencies should include ['btc', 'eth', 'eur', 'usd']
      const pricesProviderFiatCodes = ['usd', 'eth', 'eur'];
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/1`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({
              data: rawify(pricesProviderFiatCodes),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['ETH', 'EUR', 'USD']);
    });

    it("should return the ordered list of supported fiat codes (assuming provider's response contains uppercase codes)", async () => {
      const chain = chainBuilder().build();
      // So BalancesApiManager available currencies should include ['btc', 'eth', 'eur', 'usd']
      const pricesProviderFiatCodes = ['USD', 'ETH'];
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/1`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({
              data: rawify(pricesProviderFiatCodes),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['ETH', 'USD']);
    });

    it('should get an empty array of fiat currencies on failure', async () => {
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/1`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect([]);
    });
  });
});
