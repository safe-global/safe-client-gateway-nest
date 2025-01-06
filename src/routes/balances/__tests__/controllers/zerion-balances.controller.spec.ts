import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import {
  zerionAttributesBuilder,
  zerionFungibleInfoBuilder,
  zerionImplementationBuilder,
  zerionQuantityBuilder,
  zerionBalanceBuilder,
  zerionFlagsBuilder,
  zerionBalancesBuilder,
} from '@/datasources/balances-api/entities/__tests__/zerion-balance.entity.builder';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import sample from 'lodash/sample';
import { balancesProviderBuilder } from '@/domain/chains/entities/__tests__/balances-provider.builder';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let zerionBaseUri: string;
  let zerionChainIds: Array<string>;
  let zerionCurrencies: Array<string>;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      balances: {
        ...defaultConfiguration.balances,
        providers: {
          ...defaultConfiguration.balances.providers,
          zerion: {
            ...defaultConfiguration.balances.providers.zerion,
            limitCalls: 5,
            limitPeriodSeconds: 2,
          },
        },
      },
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

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    zerionBaseUri = configurationService.getOrThrow(
      'balances.providers.zerion.baseUri',
    );
    zerionChainIds = configurationService.getOrThrow(
      'features.zerionBalancesChainIds',
    );
    zerionCurrencies = configurationService.getOrThrow(
      'balances.providers.zerion.currencies',
    );

    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Balances provider: Zerion', () => {
    describe('GET /balances', () => {
      it(`maps native coin + ERC20 token balance correctly, and sorts balances by fiatBalance`, async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const currency = sample(zerionCurrencies);
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().build(),
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
            zerionImplementationBuilder().build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with(
                    'quantity',
                    zerionQuantityBuilder()
                      .with('int', '12000000000000000')
                      .with('decimals', 15)
                      .build(),
                  )
                  .with('value', 20.002)
                  .with('price', 10.1)
                  .with('fungible_info', erc20TokenFungibleInfo)
                  .with(
                    'flags',
                    zerionFlagsBuilder().with('displayable', true).build(),
                  )
                  .build(),
              )
              .build(),
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with(
                    'quantity',
                    zerionQuantityBuilder()
                      .with('int', '25000000000000000')
                      .build(),
                  )
                  .with('value', 100.001)
                  .with('price', 5.05)
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .with(
                    'flags',
                    zerionFlagsBuilder().with('displayable', true).build(),
                  )
                  .build(),
              )
              .build(),
          ])
          .build();
        const apiKey = configurationService.getOrThrow<string>(
          `balances.providers.zerion.apiKey`,
        );
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: rawify(zerionApiBalancesResponse),
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
          .expect(({ body }) => {
            expect(body).toEqual({
              fiatTotal: '120.003',
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
                  balance: '25000000000000000',
                  fiatBalance: '100.001',
                  fiatConversion: '5.05',
                },
                {
                  tokenInfo: {
                    type: 'ERC20',
                    address: erc20TokenFungibleInfo.implementations[0].address
                      ? getAddress(
                          erc20TokenFungibleInfo.implementations[0].address,
                        )
                      : erc20TokenFungibleInfo.implementations[0].address,
                    decimals: 15,
                    symbol: erc20TokenFungibleInfo.symbol,
                    name: erc20TokenFungibleInfo.name,
                    logoUri: erc20TokenFungibleInfo.icon?.url,
                  },
                  balance: '12000000000000000',
                  fiatBalance: '20.002',
                  fiatConversion: '10.1',
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0].url).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0].url).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        );
        expect(
          networkService.get.mock.calls[1][0].networkRequest,
        ).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            currency: currency?.toLowerCase(),
            sort: 'value',
          },
        });
      });

      it('returns large numbers as is (not in scientific notation)', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const currency = sample(zerionCurrencies);
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().build(),
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('icon', null)
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
            zerionImplementationBuilder().build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with(
                    'quantity',
                    zerionQuantityBuilder()
                      .with('int', '12000000000000000')
                      .with('decimals', 15)
                      .build(),
                  )
                  .with('value', 20000000000000000)
                  .with('price', 10.1)
                  .with('fungible_info', erc20TokenFungibleInfo)
                  .with(
                    'flags',
                    zerionFlagsBuilder().with('displayable', true).build(),
                  )
                  .build(),
              )
              .build(),
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with(
                    'quantity',
                    zerionQuantityBuilder()
                      .with('int', '25000000000000000')
                      .build(),
                  )
                  .with('value', 100000000000000000)
                  .with('price', 5.05)
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .with(
                    'flags',
                    zerionFlagsBuilder().with('displayable', true).build(),
                  )
                  .build(),
              )
              .build(),
          ])
          .build();
        const apiKey = configurationService.getOrThrow<string>(
          `balances.providers.zerion.apiKey`,
        );
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: rawify(zerionApiBalancesResponse),
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
          .expect(({ body }) => {
            expect(body).toEqual({
              fiatTotal: '120000000000000000',
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
                  balance: '25000000000000000',
                  fiatBalance: '100000000000000000',
                  fiatConversion: '5.05',
                },
                {
                  tokenInfo: {
                    type: 'ERC20',
                    address: erc20TokenFungibleInfo.implementations[0].address
                      ? getAddress(
                          erc20TokenFungibleInfo.implementations[0].address,
                        )
                      : erc20TokenFungibleInfo.implementations[0].address,
                    decimals: 15,
                    symbol: erc20TokenFungibleInfo.symbol,
                    name: erc20TokenFungibleInfo.name,
                    logoUri: '',
                  },
                  balance: '12000000000000000',
                  fiatBalance: '20000000000000000',
                  fiatConversion: '10.1',
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0].url).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0].url).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        );
        expect(
          networkService.get.mock.calls[1][0].networkRequest,
        ).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            currency: currency?.toLowerCase(),
            sort: 'value',
          },
        });
      });

      it('fails when an unsupported fiatCode is provided', async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const unsupportedCurrency = faker.string.alpha({
          length: { min: 4, max: 4 },
          exclude: zerionCurrencies,
        });
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${unsupportedCurrency}`,
          )
          .expect(400)
          .expect({
            code: 400,
            message: `Unsupported currency code: ${unsupportedCurrency}`,
          });
      });
    });

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = zerionChainIds[0];
        const safeAddress = faker.finance.ethereumAddress();
        const currency = faker.finance.currencyCode();
        const error = new NetworkResponseError(
          new URL(
            `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/balances/${currency}`,
          ),
          {
            status: 500,
          } as Response,
        );
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.reject(error);
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: rawify(zerionBalancesBuilder().with('data', []).build()),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(500)
          .expect({
            message: 'An error occurred',
            code: 500,
          });
      });
    });

    describe('Zerion Balances API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = faker.finance.ethereumAddress();
        const currency = sample(zerionCurrencies);
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.reject(new Error('test error'));
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${currency}`,
          )
          .expect(503)
          .expect({
            code: 503,
            message: 'Service unavailable',
          });
      });
    });

    describe('Rate Limit error', () => {
      it('does not trigger a rate-limit error', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const currency = sample(zerionCurrencies);
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', erc20TokenFungibleInfo)
                  .build(),
              )
              .build(),
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .build(),
              )
              .build(),
          ])
          .build();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: rawify(zerionApiBalancesResponse),
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
          .expect(({ body }) => {
            expect(body).toEqual({
              fiatTotal: expect.any(String),
              items: expect.any(Array),
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
      });

      it('triggers a rate-limit error', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const nativeCoinFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder()
              .with('address', null)
              .with('chain_id', chainName)
              .build(),
          ])
          .build();
        const erc20TokenFungibleInfo = zerionFungibleInfoBuilder()
          .with('implementations', [
            zerionImplementationBuilder().with('chain_id', chainName).build(),
          ])
          .build();
        const zerionApiBalancesResponse = zerionBalancesBuilder()
          .with('data', [
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', erc20TokenFungibleInfo)
                  .build(),
              )
              .build(),
            zerionBalanceBuilder()
              .with(
                'attributes',
                zerionAttributesBuilder()
                  .with('fungible_info', nativeCoinFungibleInfo)
                  .build(),
              )
              .build(),
          ])
          .build();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`:
              return Promise.resolve({
                data: rawify(zerionApiBalancesResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        const limitCalls = configurationService.getOrThrow<number>(
          'balances.providers.zerion.limitCalls',
        );

        // Note: each request use a different currency code to avoid cache hits.
        // The last request will trigger the rate limit error.
        // This assumes the test configuration follows the rule: zerionCurrencies.length > limitCalls
        for (let i = 0; i < limitCalls; i++) {
          await request(app.getHttpServer())
            .get(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${zerionCurrencies[i]}`,
            )
            .expect(200);
        }

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safeAddress}/balances/${zerionCurrencies[limitCalls]}`,
          )
          .expect(429);

        // Calls expected: 'limitCalls' calls to Zerion + 1 call to ConfigApi
        expect(networkService.get.mock.calls.length).toBe(limitCalls + 1);
      });
    });
  });
});
