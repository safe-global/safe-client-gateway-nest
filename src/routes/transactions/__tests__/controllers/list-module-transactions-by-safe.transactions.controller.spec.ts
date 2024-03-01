import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
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
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('List module transactions by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const error = new NetworkResponseError(
      new URL(`${safeConfigUrl}/api/v1/chains/${chainId}`),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Failure: Transaction API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: chainResponse,
      status: 200,
    });
    const error = new NetworkResponseError(
      new URL(
        `${chainResponse.transactionService}/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Failure: data page validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const page = pageBuilder().build();
    const chain = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({ data: chain, status: 200 });
    networkService.get.mockResolvedValueOnce({
      data: { ...page, count: faker.word.words() },
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(500)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('Get module transaction should return 404', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: chainResponse,
      status: 200,
    });
    const error = new NetworkResponseError(
      new URL(
        `${chainResponse.transactionService}/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`,
      ),
      { status: 404 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Get module transaction successfully', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    const moduleTransaction1 = moduleTransactionBuilder().build();
    const moduleTransaction2 = moduleTransactionBuilder().build();
    const moduleTransaction = {
      count: 2,
      next: null,
      previous: null,
      results: [
        moduleTransactionToJson(moduleTransaction1),
        moduleTransactionToJson(moduleTransaction2),
      ],
    };

    const safe = safeBuilder().build();
    networkService.get.mockResolvedValueOnce({
      data: chainResponse,
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: moduleTransaction,
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({ data: safe, status: 200 });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `module_${moduleTransaction1.safe}_${moduleTransaction1.moduleTransactionId}`,
                safeAppInfo: null,
                timestamp: moduleTransaction1.executionDate.getTime(),
                txStatus: expect.any(String),
                txInfo: {
                  type: expect.any(String),
                },
                executionInfo: {
                  type: 'MODULE',
                  address: { value: moduleTransaction1.module },
                },
              },
              conflictType: 'None',
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `module_${moduleTransaction2.safe}_${moduleTransaction2.moduleTransactionId}`,
                safeAppInfo: null,
                timestamp: moduleTransaction2.executionDate.getTime(),
                txStatus: expect.any(String),
                txInfo: {
                  type: expect.any(String),
                },
                executionInfo: {
                  type: 'MODULE',
                  address: { value: moduleTransaction2.module },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });
});
