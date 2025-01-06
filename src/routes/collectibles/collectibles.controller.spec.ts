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
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { collectibleBuilder } from '@/domain/collectibles/entities/__tests__/collectible.builder';
import type { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { getAddress } from 'viem';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Collectibles Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        counterfactualBalances: false,
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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v2/collectibles', () => {
    it('is successful', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const pageLimit = 1;
      const safeResponse = safeBuilder().build();
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', limitAndOffsetUrlFactory(pageLimit, 0))
        .with('previous', limitAndOffsetUrlFactory(pageLimit, 0))
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({
              data: rawify(collectiblesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(200)
        .expect((response) => {
          expect(response.body.count).toBe(collectiblesResponse.count);
          expect(response.body.results).toStrictEqual([
            collectiblesResponse.results[0],
            collectiblesResponse.results[1],
            collectiblesResponse.results[2],
          ]);
          expect(response.body.next).toContain(`limit%3D${pageLimit}`);
          expect(response.body.next).toContain(`limit%3D${pageLimit}`);
        });
    });

    it('pagination data is forwarded to tx service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const limit = 10;
      const offset = 20;
      const safeResponse = safeBuilder().build();
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', null)
        .with('previous', null)
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({
              data: rawify(collectiblesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/safes/${safeAddress}/collectibles/?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200);

      expect(networkService.get.mock.calls[1][0].networkRequest).toStrictEqual({
        params: {
          limit: 10,
          offset: 20,
          exclude_spam: true,
          trusted: false,
        },
      });
    });

    it('excludeSpam and trusted params are forwarded to tx service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const excludeSpam = true;
      const trusted = true;
      const safeResponse = safeBuilder().build();
      const collectiblesResponse = pageBuilder<Collectible>()
        .with('next', null)
        .with('previous', null)
        .with('results', [
          collectibleBuilder().build(),
          collectibleBuilder().build(),
          collectibleBuilder().build(),
        ])
        .build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`:
            return Promise.resolve({
              data: rawify(collectiblesResponse),
              status: 200,
            });
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v2/chains/${chainId}/safes/${safeAddress}/collectibles/?exclude_spam=${excludeSpam}&trusted=${trusted}`,
        )
        .expect(200);

      expect(networkService.get.mock.calls[1][0].networkRequest).toStrictEqual({
        params: {
          limit: PaginationData.DEFAULT_LIMIT,
          offset: PaginationData.DEFAULT_OFFSET,
          exclude_spam: excludeSpam,
          trusted,
        },
      });
    });

    it('tx service collectibles returns 400', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const safeResponse = safeBuilder().build();
      const transactionServiceUrl = `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`;
      const transactionServiceError = new NetworkResponseError(
        new URL(transactionServiceUrl),
        { status: 400 } as Response,
        {
          message: 'some collectibles error',
        },
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case transactionServiceUrl:
            return Promise.reject(transactionServiceError);
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(transactionServiceError.response.status)
        .expect({
          code: transactionServiceError.response.status,
          message: (transactionServiceError.data as { message: string })
            .message,
        });
    });

    it('tx service collectibles does not return a response', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      const safeResponse = safeBuilder().build();
      const transactionServiceUrl = `${chainResponse.transactionService}/api/v2/safes/${safeAddress}/collectibles/`;
      const transactionServiceError = new NetworkRequestError(
        new URL(transactionServiceUrl),
      );
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({
              data: rawify(chainResponse),
              status: 200,
            });
          case `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`:
            return Promise.resolve({ data: rawify(safeResponse), status: 200 });
          case transactionServiceUrl:
            return Promise.reject(transactionServiceError);
          default:
            return Promise.reject(new Error(`Could not match ${url}`));
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chainId}/safes/${safeAddress}/collectibles`)
        .expect(503)
        .expect({
          code: 503,
          message: 'Service unavailable',
        });
    });
  });
});
