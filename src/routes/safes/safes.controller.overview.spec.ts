import type { INestApplication } from '@nestjs/common';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import request from 'supertest';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { faker } from '@faker-js/faker';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Safes Controller Overview (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let pricesProviderUrl: string;
  let pricesApiKey: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    const testConfiguration: typeof configuration = () => ({
      ...configuration(),
      mappings: {
        ...configuration().mappings,
        safe: {
          maxOverviews: 3,
        },
      },
      features: {
        ...configuration().features,
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
    pricesApiKey = configurationService.getOrThrow(
      'balances.providers.safe.prices.apiKey',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /safes', () => {
    it('overview with transactions awaiting confirmation is correctly serialised', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
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
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const multisigTransactions = [
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('confirmationsRequired', 0)
            .with('confirmations', [
              // Signature provided
              confirmationBuilder().with('owner', walletAddress).build(),
            ])
            .build(),
        ),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo.address,
                name: null,
                logoUri: null,
              },
              chainId: chain.chainId,
              threshold: safeInfo.threshold,
              owners: safeInfo.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: 2,
              awaitingConfirmation: 1,
            },
          ]),
        );

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: currency.toLowerCase(),
        },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });

    it('should not return awaiting confirmations if no more confirmations are required', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
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
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const multisigTransactions = [
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('confirmationsRequired', 0)
            .with('confirmations', [
              // Not wallet address
              confirmationBuilder()
                .with('owner', getAddress(faker.finance.ethereumAddress()))
                .build(),
            ])
            .build(),
        ),
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('confirmationsRequired', 0)
            .with('confirmations', [
              // Not wallet address
              confirmationBuilder()
                .with('owner', getAddress(faker.finance.ethereumAddress()))
                .build(),
            ])
            .build(),
        ),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo.address,
                name: null,
                logoUri: null,
              },
              chainId: chain.chainId,
              threshold: safeInfo.threshold,
              owners: safeInfo.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: 2,
              awaitingConfirmation: 0,
            },
          ]),
        );

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: currency.toLowerCase(),
        },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });

    it('overview of multiple Safes across different chains is correctly serialised', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse1 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain1.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
        [chain2.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions1 = pageBuilder().build();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            return Promise.resolve({ data: rawify(chain1), status: 200 });
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: rawify(chain2), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            return Promise.resolve({ data: rawify(safeInfo1), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: rawify(safeInfo2), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: rawify(safeInfo3), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse3),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }

          case `${pricesProviderUrl}/simple/token_price/${chain1.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain2.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions3),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo1.address,
                name: null,
                logoUri: null,
              },
              chainId: chain1.chainId,
              threshold: safeInfo1.threshold,
              owners: safeInfo1.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions1.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('should limit the amount of overviewed Safes', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();
      // Extra Safe
      const safeInfo4 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse1 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain1.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
        [chain2.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions1 = pageBuilder().build();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            return Promise.resolve({ data: rawify(chain1), status: 200 });
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: rawify(chain2), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            return Promise.resolve({ data: rawify(safeInfo1), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: rawify(safeInfo2), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: rawify(safeInfo3), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse3),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain1.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain2.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions3),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address},${chain2.chainId}:${safeInfo4.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              address: {
                value: safeInfo1.address,
                name: null,
                logoUri: null,
              },
              chainId: chain1.chainId,
              threshold: safeInfo1.threshold,
              owners: safeInfo1.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions1.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('returns awaiting confirmation as null if no wallet address is', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
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
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}`,
        )
        .expect(200)
        .expect([
          {
            address: {
              value: safeInfo.address,
              name: null,
              logoUri: null,
            },
            chainId: chain.chainId,
            threshold: safeInfo.threshold,
            owners: safeInfo.owners.map((owner) => ({
              value: owner,
              name: null,
              logoUri: null,
            })),
            fiatTotal: '5410.25',
            queued: 2,
            // No wallet address specified
            awaitingConfirmation: null,
          },
        ]);

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        params: { trusted: false, exclude_spam: true },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: currency.toLowerCase(),
        },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });

    it('forwards trusted and exclude spam queries', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
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
      const walletAddress = faker.finance.ethereumAddress();
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&wallet_address=${walletAddress}&trusted=${true}&exclude_spam=${false}`,
        )
        .expect(200)
        .expect([
          {
            address: {
              value: safeInfo.address,
              name: null,
              logoUri: null,
            },
            chainId: chain.chainId,
            threshold: safeInfo.threshold,
            owners: safeInfo.owners.map((owner) => ({
              value: owner,
              name: null,
              logoUri: null,
            })),
            fiatTotal: '5410.25',
            queued: 2,
            awaitingConfirmation: 2,
          },
        ]);

      expect(networkService.get.mock.calls.length).toBe(7);

      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[2][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}`,
      );
      expect(networkService.get.mock.calls[3][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`,
      );
      expect(networkService.get.mock.calls[3][0].networkRequest).toStrictEqual({
        // Forwarded params
        params: { trusted: true, exclude_spam: false },
      });
      expect(networkService.get.mock.calls[4][0].url).toBe(
        `${pricesProviderUrl}/simple/token_price/${chain.pricesProvider.chainName}`,
      );
      expect(networkService.get.mock.calls[4][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          vs_currencies: currency.toLowerCase(),
          contract_addresses: [
            tokenAddress.toLowerCase(),
            secondTokenAddress.toLowerCase(),
          ].join(','),
        },
      });
      expect(networkService.get.mock.calls[5][0].url).toBe(
        `${pricesProviderUrl}/simple/price`,
      );
      expect(networkService.get.mock.calls[5][0].networkRequest).toStrictEqual({
        headers: { 'x-cg-pro-api-key': pricesApiKey },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: currency.toLowerCase(),
        },
      });
      expect(networkService.get.mock.calls[6][0].url).toBe(
        `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`,
      );
    });
  });

  describe('Validation', () => {
    it('omits erroneous Safes on chains returning an error from the Config Service', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse1 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain1.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
        [chain2.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions1 = pageBuilder().build();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            const error = new NetworkResponseError(
              new URL(`${safeConfigUrl}/api/v1/chains/${chain1.chainId}`),
              {
                status: 404,
              } as Response,
            );
            return Promise.reject(error);
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: rawify(chain2), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            return Promise.resolve({ data: rawify(safeInfo1), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: rawify(safeInfo2), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: rawify(safeInfo3), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse3),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain1.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain2.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions3),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            // safeInfo1 is omitted
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('omits erroneous Safes from the Transaction Service', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain1.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
        [chain2.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            return Promise.resolve({ data: rawify(chain1), status: 200 });
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: rawify(chain2), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            const error = new NetworkResponseError(
              new URL(
                `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`,
              ),
              {
                status: 500,
              } as Response,
            );
            return Promise.reject(error);
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: rawify(safeInfo2), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: rawify(safeInfo3), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse3),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain1.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain2.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions3),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            // safeInfo1 is omitted
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('omits erroneous Safes validation of the Transaction Service return Promise.rejects', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '10').build();
      const safeInfo1 = safeBuilder().build();
      const safeInfo2 = safeBuilder().build();
      const safeInfo3 = safeBuilder().build();

      const tokenAddress1 = faker.finance.ethereumAddress();
      const tokenAddress2 = faker.finance.ethereumAddress();
      const secondTokenAddress1 = faker.finance.ethereumAddress();
      const secondTokenAddress2 = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse1 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse2 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress2))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress1))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const transactionApiBalancesResponse3 = [
        balanceBuilder()
          .with('tokenAddress', null)
          .with('balance', '3000000000000000000')
          .with('token', null)
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress1))
          .with('balance', '4000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
        balanceBuilder()
          .with('tokenAddress', getAddress(secondTokenAddress2))
          .with('balance', '3000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [chain1.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
        [chain2.pricesProvider.nativeCoin!]: {
          [currency.toLowerCase()]: 1536.75,
        },
      };
      const tokenPriceProviderResponse = {
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [tokenAddress1]: { [currency.toLowerCase()]: 12.5 },
        [secondTokenAddress1]: { [currency.toLowerCase()]: 10 },
        [secondTokenAddress2]: { [currency.toLowerCase()]: 10 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const queuedTransactions1 = pageBuilder().build();
      const queuedTransactions2 = pageBuilder().build();
      const queuedTransactions3 = pageBuilder().build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain1.chainId}`: {
            return Promise.resolve({ data: rawify(chain1), status: 200 });
          }
          case `${safeConfigUrl}/api/v1/chains/${chain2.chainId}`: {
            return Promise.resolve({ data: rawify(chain2), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}`: {
            return Promise.resolve({ data: rawify('invalid'), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}`: {
            return Promise.resolve({ data: rawify(safeInfo2), status: 200 });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}`: {
            return Promise.resolve({ data: rawify(safeInfo3), status: 200 });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse3),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain1.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chain2.pricesProvider.chainName}`: {
            return Promise.resolve({
              data: rawify(tokenPriceProviderResponse),
              status: 200,
            });
          }
          case `${chain1.transactionService}/api/v1/safes/${safeInfo1.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions1),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo2.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions2),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/safes/${safeInfo3.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions3),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain1.chainId}:${safeInfo1.address},${chain2.chainId}:${safeInfo2.address},${chain2.chainId}:${safeInfo3.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            // safeInfo1 is omitted
            {
              address: {
                value: safeInfo2.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo2.threshold,
              owners: safeInfo2.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '4910.25',
              queued: queuedTransactions2.count,
              awaitingConfirmation: expect.any(Number),
            },
            {
              address: {
                value: safeInfo3.address,
                name: null,
                logoUri: null,
              },
              chainId: chain2.chainId,
              threshold: safeInfo3.threshold,
              owners: safeInfo3.owners.map((owner) => ({
                value: owner,
                name: null,
                logoUri: null,
              })),
              fiatTotal: '5410.25',
              queued: queuedTransactions3.count,
              awaitingConfirmation: expect.any(Number),
            },
          ]),
        );
    });

    it('should return a 0-balance when an error is thrown by the provider', async () => {
      const chain = chainBuilder().with('chainId', '10').build();
      const safeInfo = safeBuilder().build();
      const tokenAddress = faker.finance.ethereumAddress();
      const transactionApiBalancesResponse = [
        balanceBuilder()
          .with('tokenAddress', getAddress(tokenAddress))
          .with('balance', '40000000000000000000000000000000000')
          .with('token', balanceTokenBuilder().with('decimals', 17).build())
          .build(),
      ];
      const nativeCoinId = chain.pricesProvider.nativeCoin;
      const chainName = chain.pricesProvider.chainName;
      const currency = faker.finance.currencyCode();
      const nativeCoinPriceProviderResponse = {
        [nativeCoinId!]: { [currency.toLowerCase()]: 1536.75 },
      };
      const walletAddress = faker.finance.ethereumAddress();
      const multisigTransactions = [
        multisigTransactionToJson(multisigTransactionBuilder().build()),
        multisigTransactionToJson(multisigTransactionBuilder().build()),
      ];
      const queuedTransactions = pageBuilder()
        .with('results', multisigTransactions)
        .with('count', multisigTransactions.length)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`: {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`: {
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/balances/`: {
            return Promise.resolve({
              data: rawify(transactionApiBalancesResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/price`: {
            return Promise.resolve({
              data: rawify(nativeCoinPriceProviderResponse),
              status: 200,
            });
          }
          case `${pricesProviderUrl}/simple/token_price/${chainName}`: {
            return Promise.reject();
          }
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`: {
            return Promise.resolve({
              data: rawify(queuedTransactions),
              status: 200,
            });
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/safes?currency=${currency}&safes=${chain.chainId}:${safeInfo.address}&wallet_address=${walletAddress}`,
        )
        .expect(200)
        .expect([
          {
            address: {
              value: safeInfo.address,
              name: null,
              logoUri: null,
            },
            chainId: chain.chainId,
            threshold: safeInfo.threshold,
            owners: safeInfo.owners.map((owner) => ({
              value: owner,
              name: null,
              logoUri: null,
            })),
            fiatTotal: '0',
            queued: 2,
            awaitingConfirmation: 2,
          },
        ]);
    });
  });
});
