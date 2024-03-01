import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { faker } from '@faker-js/faker';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Balances Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let pricesProviderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    pricesProviderUrl = configurationService.get('prices.baseUri');
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
      const safeAddress = faker.finance.ethereumAddress();
      const tokenAddress = faker.finance.ethereumAddress();
      const secondTokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', tokenAddress)
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', secondTokenAddress)
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(`prices.chains.${chain.chainId}.nativeCoin`);
      const apiKey = app.get(IConfigurationService).getOrThrow('prices.apiKey');
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency.toLowerCase()]: 1536.75 },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress]: { [currency.toLowerCase()]: 10 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          case `${pricesProviderUrl}/simple/price`:
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
              status: 200,
            });
          case `${pricesProviderUrl}/simple/token_price/${chainName}`:
            return Promise.resolve({
              data: tokenPriceProviderResponse,
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
                address: transactionApiBalancesResponse[1].tokenAddress,
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
                address: transactionApiBalancesResponse[2].tokenAddress,
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
      // (1. Chain data, 2. Balances, 3. Coingecko native coin, 4. Coingecko tokens)
      expect(networkService.get.mock.calls.length).toBe(4);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      );
      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[2][0]).toBe(
        `${pricesProviderUrl}/simple/token_price/${chainName}`,
      );
      expect(networkService.get.mock.calls[2][1]).toStrictEqual({
        headers: { 'x-cg-pro-api-key': apiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[3][0]).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[3][1]).toStrictEqual({
        headers: { 'x-cg-pro-api-key': apiKey },
        params: { ids: nativeCoinId, vs_currencies: currency.toLowerCase() },
      });
    });

    it(`excludeSpam and trusted params are forwarded to tx service`, async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = faker.finance.ethereumAddress();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', tokenAddress)
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const excludeSpam = true;
      const trusted = true;
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
      const currency = faker.finance.currencyCode();
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 2.5 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          case `${pricesProviderUrl}/simple/token_price/${chainName}`:
            return Promise.resolve({
              data: tokenPriceProviderResponse,
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
      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: {
          trusted,
          exclude_spam: excludeSpam,
        },
      });
    });

    it(`maps native token correctly`, async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinId = app
        .get(IConfigurationService)
        .getOrThrow(`prices.chains.${chain.chainId}.nativeCoin`);
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId]: { [currency.toLowerCase()]: 1536.75 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          case `${pricesProviderUrl}/simple/price`:
            return Promise.resolve({
              data: nativeCoinPriceProviderResponse,
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

    it('returns large numbers as is (not in scientific notation)', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeAddress = faker.finance.ethereumAddress();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', tokenAddress)
          .with('balance', '40000000000000000000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const chainName = app
        .get(IConfigurationService)
        .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
      const currency = faker.finance.currencyCode();
      const tokenPriceProviderResponse = {
        [tokenAddress]: { [currency.toLowerCase()]: 2.5 },
      };
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
            return Promise.resolve({
              data: transactionApiBalancesResponse,
              status: 200,
            });
          case `${pricesProviderUrl}/simple/token_price/${chainName}`:
            return Promise.resolve({
              data: tokenPriceProviderResponse,
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
                address: transactionApiBalancesResponse[0].tokenAddress,
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
      // (1. Chain data, 2. Balances, 3. Coingecko token)
      expect(networkService.get.mock.calls.length).toBe(3);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`,
      );
      expect(networkService.get.mock.calls[1][1]).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[2][0]).toBe(
        `${pricesProviderUrl}/simple/token_price/${chainName}`,
      );
    });

    describe('Config API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = faker.finance.ethereumAddress();
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
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({
                data: transactionApiBalancesResponse,
                status: 200,
              });
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
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
                  address: transactionApiBalancesResponse[0].tokenAddress,
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

        expect(networkService.get.mock.calls.length).toBe(3);
      });

      it(`should return a 0-balance when a validation error happens`, async () => {
        const chain = chainBuilder().with('chainId', '10').build();
        const safeAddress = faker.finance.ethereumAddress();
        const tokenAddress = faker.finance.ethereumAddress();
        const transactionApiBalancesResponse = [
          balanceBuilder()
            .with('tokenAddress', tokenAddress)
            .with('balance', '40000000000000000000000000000000000')
            .with('token', balanceTokenBuilder().with('decimals', 17).build())
            .build(),
        ];
        const chainName = app
          .get(IConfigurationService)
          .getOrThrow(`prices.chains.${chain.chainId}.chainName`);
        const tokenPriceProviderResponse = 'notAnObject';
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}/balances/`:
              return Promise.resolve({
                data: transactionApiBalancesResponse,
                status: 200,
              });
            case `${pricesProviderUrl}/simple/token_price/${chainName}`:
              return Promise.resolve({
                data: tokenPriceProviderResponse,
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
                  address: transactionApiBalancesResponse[0].tokenAddress,
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

        expect(networkService.get.mock.calls.length).toBe(3);
      });
    });

    describe('Transaction API Error', () => {
      it(`500 error response`, async () => {
        const chainId = '1';
        const safeAddress = faker.finance.ethereumAddress();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        const transactionServiceUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/`;
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse, status: 200 });
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

        expect(networkService.get.mock.calls.length).toBe(2);
      });

      it(`500 error if validation fails`, async () => {
        const chainId = '1';
        const safeAddress = faker.finance.ethereumAddress();
        const chainResponse = chainBuilder().with('chainId', chainId).build();
        networkService.get.mockImplementation((url) => {
          if (url == `${safeConfigUrl}/api/v1/chains/${chainId}`) {
            return Promise.resolve({ data: chainResponse, status: 200 });
          } else if (
            url ==
            `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/balances/`
          ) {
            return Promise.resolve({
              data: [{ invalid: 'data' }],
              status: 200,
            });
          } else {
            return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances/usd`)
          .expect(500)
          .expect({
            message: 'Validation failed',
            code: 42,
            arguments: [],
          });

        expect(networkService.get.mock.calls.length).toBe(2);
      });
    });
  });

  describe('GET /balances/supported-fiat-codes', () => {
    it('should return the ordered list of supported fiat codes', async () => {
      const pricesProviderFiatCodes = ['chf', 'gbp', 'eur', 'eth', 'afn'];
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({
              data: pricesProviderFiatCodes,
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(200)
        .expect(['AFN', 'CHF', 'ETH', 'EUR', 'GBP']);
    });

    it('should fail getting fiat currencies data from prices provider', async () => {
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(503)
        .expect({
          code: 503,
          message: 'Error getting Fiat Codes from prices provider',
        });
    });

    it('validation error getting fiat currencies data from prices provider', async () => {
      const pricesProviderFiatCodes: Array<string> = [];
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({
              data: pricesProviderFiatCodes,
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });

    it('validation error (2) getting fiat currencies data from prices provider', async () => {
      const pricesProviderFiatCodes = 'notAnArray';
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${pricesProviderUrl}/simple/supported_vs_currencies`:
            return Promise.resolve({
              data: pricesProviderFiatCodes,
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get('/v1/balances/supported-fiat-codes')
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
