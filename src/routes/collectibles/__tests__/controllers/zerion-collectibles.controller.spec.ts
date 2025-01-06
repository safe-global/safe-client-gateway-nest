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
import {
  zerionCollectibleAttributesBuilder,
  zerionCollectibleBuilder,
  zerionCollectiblesBuilder,
  zerionNFTInfoBuilder,
} from '@/datasources/balances-api/entities/__tests__/zerion-collectible.entity.builder';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { balancesProviderBuilder } from '@/domain/chains/entities/__tests__/balances-provider.builder';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Zerion Collectibles Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let zerionBaseUri: string;
  let zerionChainIds: Array<string>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
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
    zerionBaseUri = configurationService.getOrThrow(
      'balances.providers.zerion.baseUri',
    );
    zerionChainIds = configurationService.getOrThrow(
      'features.zerionBalancesChainIds',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Collectibles provider: Zerion', () => {
    describe('GET /v2/collectibles', () => {
      it('successfully gets collectibles from Zerion', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const aTokenAddress = getAddress(faker.finance.ethereumAddress());
        const aNFTName = faker.string.sample();
        const aUrl = faker.internet.url({ appendSlash: false });
        const zerionApiCollectiblesResponse = zerionCollectiblesBuilder()
          .with('links', { next: null })
          .with('data', [
            zerionCollectibleBuilder()
              .with(
                'attributes',
                zerionCollectibleAttributesBuilder()
                  .with(
                    'nft_info',
                    zerionNFTInfoBuilder()
                      .with('contract_address', aTokenAddress)
                      .build(),
                  )
                  .build(),
              )
              .build(),
            zerionCollectibleBuilder()
              .with(
                'attributes',
                zerionCollectibleAttributesBuilder()
                  .with(
                    'nft_info',
                    zerionNFTInfoBuilder().with('name', aNFTName).build(),
                  )
                  .build(),
              )
              .build(),
            zerionCollectibleBuilder()
              .with(
                'attributes',
                zerionCollectibleAttributesBuilder()
                  .with(
                    'nft_info',
                    zerionNFTInfoBuilder()
                      .with('content', {
                        preview: { url: aUrl },
                        detail: { url: aUrl },
                      })
                      .build(),
                  )
                  .build(),
              )
              .build(),
          ])
          .build();
        const apiKey = app
          .get<IConfigurationService>(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.resolve({
                data: rawify(zerionApiCollectiblesResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles`)
          .expect(200)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              count: null,
              next: null,
              previous: null,
              results: [
                {
                  address: getAddress(aTokenAddress),
                  tokenName:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .name,
                  tokenSymbol:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .name,
                  logoUri:
                    zerionApiCollectiblesResponse.data[0].attributes
                      .collection_info?.content?.icon.url,
                  id: zerionApiCollectiblesResponse.data[0].attributes.nft_info
                    .token_id,
                  uri: zerionApiCollectiblesResponse.data[0].attributes.nft_info
                    .content?.detail?.url,
                  name: zerionApiCollectiblesResponse.data[0].attributes
                    .collection_info?.name,
                  description:
                    zerionApiCollectiblesResponse.data[0].attributes
                      .collection_info?.description,
                  imageUri:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .content?.preview?.url,
                  metadata:
                    zerionApiCollectiblesResponse.data[0].attributes.nft_info
                      .content,
                },
                {
                  address: getAddress(
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .contract_address,
                  ),
                  tokenName: aNFTName,
                  tokenSymbol:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .name,
                  logoUri:
                    zerionApiCollectiblesResponse.data[1].attributes
                      .collection_info?.content?.icon.url,
                  id: zerionApiCollectiblesResponse.data[1].attributes.nft_info
                    .token_id,
                  uri: zerionApiCollectiblesResponse.data[1].attributes.nft_info
                    .content?.detail?.url,
                  name: zerionApiCollectiblesResponse.data[1].attributes
                    .collection_info?.name,
                  description:
                    zerionApiCollectiblesResponse.data[1].attributes
                      .collection_info?.description,
                  imageUri:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .content?.preview?.url,
                  metadata:
                    zerionApiCollectiblesResponse.data[1].attributes.nft_info
                      .content,
                },
                {
                  address: getAddress(
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .contract_address,
                  ),
                  tokenSymbol:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .name,
                  logoUri:
                    zerionApiCollectiblesResponse.data[2].attributes
                      .collection_info?.content?.icon.url,
                  id: zerionApiCollectiblesResponse.data[2].attributes.nft_info
                    .token_id,
                  uri: aUrl,
                  name: zerionApiCollectiblesResponse.data[2].attributes
                    .collection_info?.name,
                  description:
                    zerionApiCollectiblesResponse.data[2].attributes
                      .collection_info?.description,
                  imageUri:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .content?.preview?.url,
                  metadata:
                    zerionApiCollectiblesResponse.data[2].attributes.nft_info
                      .content,
                },
              ],
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0].url).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0].url).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`,
        );
        expect(
          networkService.get.mock.calls[1][0].networkRequest,
        ).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            sort: '-floor_price',
            'page[size]': 20,
          },
        });
      });

      it('successfully maps pagination option (no limit)', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const inputPaginationCursor = `cursor=${encodeURIComponent(`&offset=10`)}`;
        const zerionNext = `${faker.internet.url({ appendSlash: false })}?page%5Bsize%5D=20&page%5Bafter%5D=IjMwIg==`;
        const expectedNext = `${encodeURIComponent(`limit=20&offset=30`)}`;
        const zerionApiCollectiblesResponse = zerionCollectiblesBuilder()
          .with('data', [
            zerionCollectibleBuilder().build(),
            zerionCollectibleBuilder().build(),
          ])
          .with('links', { next: zerionNext })
          .build();
        const apiKey = app
          .get<IConfigurationService>(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.resolve({
                data: rawify(zerionApiCollectiblesResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles?${inputPaginationCursor}`,
          )
          .expect(200)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              count: null,
              next: expect.stringContaining(expectedNext),
              previous: null,
              results: expect.any(Array),
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0].url).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0].url).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`,
        );
        expect(
          networkService.get.mock.calls[1][0].networkRequest,
        ).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            sort: '-floor_price',
            'page[size]': 20,
            'page[after]': 'IjEwIg==',
          },
        });
      });

      it('successfully maps pagination option (no offset)', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const paginationLimit = 4;
        const inputPaginationCursor = `cursor=${encodeURIComponent(`limit=${paginationLimit}`)}`;
        const zerionNext = `${faker.internet.url({ appendSlash: false })}?page%5Bsize%5D=4&page%5Bafter%5D=IjQi`;
        const expectedNext = `${encodeURIComponent(`limit=${paginationLimit}&offset=4`)}`;
        const zerionApiCollectiblesResponse = zerionCollectiblesBuilder()
          .with('data', [
            zerionCollectibleBuilder().build(),
            zerionCollectibleBuilder().build(),
          ])
          .with('links', { next: zerionNext })
          .build();
        const apiKey = app
          .get<IConfigurationService>(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.resolve({
                data: rawify(zerionApiCollectiblesResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles?${inputPaginationCursor}`,
          )
          .expect(200)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              count: null,
              next: expect.stringContaining(expectedNext),
              previous: null,
              results: expect.any(Array),
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0].url).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0].url).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`,
        );
        expect(
          networkService.get.mock.calls[1][0].networkRequest,
        ).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            sort: '-floor_price',
            'page[size]': paginationLimit,
          },
        });
      });

      it('successfully maps pagination option (both limit and offset)', async () => {
        const chainName = faker.company.name();
        const chain = chainBuilder()
          .with('chainId', zerionChainIds[0])
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', chainName).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const paginationLimit = 4;
        const inputPaginationCursor = `cursor=${encodeURIComponent(`limit=${paginationLimit}&offset=20`)}`;
        const zerionNext = `${faker.internet.url({ appendSlash: false })}?page%5Bsize%5D=4&page%5Bafter%5D=IjMwIg==`;
        const expectedNext = `${encodeURIComponent(`limit=${paginationLimit}&offset=30`)}`;
        const zerionApiCollectiblesResponse = zerionCollectiblesBuilder()
          .with('data', [
            zerionCollectibleBuilder().build(),
            zerionCollectibleBuilder().build(),
          ])
          .with('links', { next: zerionNext })
          .build();
        const apiKey = app
          .get<IConfigurationService>(IConfigurationService)
          .getOrThrow(`balances.providers.zerion.apiKey`);
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.resolve({
                data: rawify(zerionApiCollectiblesResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(
            `/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles?${inputPaginationCursor}`,
          )
          .expect(200)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              count: null,
              next: expect.stringContaining(expectedNext),
              previous: null,
              results: expect.any(Array),
            });
          });

        expect(networkService.get.mock.calls.length).toBe(2);
        expect(networkService.get.mock.calls[0][0].url).toBe(
          `${safeConfigUrl}/api/v1/chains/${chain.chainId}`,
        );
        expect(networkService.get.mock.calls[1][0].url).toBe(
          `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`,
        );
        expect(
          networkService.get.mock.calls[1][0].networkRequest,
        ).toStrictEqual({
          headers: { Authorization: `Basic ${apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            sort: '-floor_price',
            'page[size]': paginationLimit,
            'page[after]': 'IjIwIg==',
          },
        });
      });
    });

    describe('Zerion Balances API Error', () => {
      it(`500 error response`, async () => {
        const chain = chainBuilder().with('chainId', zerionChainIds[0]).build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`:
              return Promise.reject(new Error('test error'));
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });

        await request(app.getHttpServer())
          .get(`/v2/chains/${chain.chainId}/safes/${safeAddress}/collectibles`)
          .expect(503)
          .expect({
            code: 503,
            message: 'Service unavailable',
          });
      });
    });
  });
});
