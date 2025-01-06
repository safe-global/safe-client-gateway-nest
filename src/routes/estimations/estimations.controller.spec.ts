import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import omit from 'lodash/omit';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { estimationBuilder } from '@/domain/estimations/entities/__tests__/estimation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { getAddress } from 'viem';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Estimations Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Get estimations', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const estimation = estimationBuilder().build();
      const lastTransaction = multisigTransactionBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        const chainsUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
        const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
        const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
        if (url === chainsUrl) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (url === multisigTransactionsUrl) {
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('count', 1)
                .with('results', [multisigTransactionToJson(lastTransaction)])
                .build(),
            ),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) => {
        const estimationsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/estimations/`;
        return url === estimationsUrl
          ? Promise.resolve({ data: rawify(estimation), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .post(
          `/v2/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions/estimations`,
        )
        .send({
          to: faker.finance.ethereumAddress(),
          value: faker.string.numeric(),
          data: faker.string.hexadecimal({ length: 32 }),
          operation: 0,
        })
        .expect(200)
        .expect({
          currentNonce: safe.nonce,
          recommendedNonce: Math.max(safe.nonce, lastTransaction.nonce + 1),
          safeTxGas: estimation.safeTxGas,
        });
    });
  });

  it('should validate the response', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const estimation = { invalid: 'value' };
    const lastTransaction = multisigTransactionBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const chainsUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('count', 1)
              .with('results', [multisigTransactionToJson(lastTransaction)])
              .build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.post.mockImplementation(({ url }) => {
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: rawify(estimation), status: 200 })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions/estimations`,
      )
      .send({
        to: faker.finance.ethereumAddress(),
        value: faker.string.numeric(),
        data: faker.string.hexadecimal({ length: 32 }),
        operation: 0,
      })
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('Should get a validation error', async () => {
    const getEstimationDto = {
      to: faker.finance.ethereumAddress(),
      value: faker.string.numeric(),
      data: faker.string.hexadecimal({ length: 32 }),
      operation: 1,
    };

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${faker.string.numeric()}/safes/${faker.finance.ethereumAddress()}/multisig-transactions/estimations`,
      )
      .send(omit(getEstimationDto, 'value'))
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['value'],
        message: 'Required',
      });
  });

  it('should return last transaction nonce plus 1 as recommended nonce', async () => {
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder()
      .with('nonce', faker.number.int({ max: 50 }))
      .build();
    const estimation = estimationBuilder().build();
    const lastTransaction = multisigTransactionBuilder()
      .with('nonce', faker.number.int({ min: 51 }))
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const chainsUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      // Param ValidationPipe checksums address
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('count', 1)
              .with('results', [multisigTransactionToJson(lastTransaction)])
              .build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.post.mockImplementation(({ url }) => {
      // Param ValidationPipe checksums address
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: rawify(estimation), status: 200 })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send({
        to: faker.finance.ethereumAddress(),
        value: faker.string.numeric(),
        data: faker.string.hexadecimal({ length: 32 }),
        operation: 0,
      })
      .expect(200)
      .expect({
        currentNonce: safe.nonce,
        recommendedNonce: lastTransaction.nonce + 1,
        safeTxGas: estimation.safeTxGas,
      });
  });

  it('should return the current safe nonce if there is no last transaction', async () => {
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', faker.number.int()).build();
    const estimation = estimationBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const chainsUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      // Param ValidationPipe checksums address
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder().with('count', 0).with('results', []).build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.post.mockImplementation(({ url }) => {
      // Param ValidationPipe checksums address
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: rawify(estimation), status: 200 })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send({
        to: faker.finance.ethereumAddress(),
        value: faker.string.numeric(),
        data: faker.string.hexadecimal({ length: 32 }),
        operation: 0,
      })
      .expect(200)
      .expect({
        currentNonce: safe.nonce,
        recommendedNonce: safe.nonce,
        safeTxGas: estimation.safeTxGas,
      });
  });

  it('should return safe nonce as recommended nonce if it is greater than last transaction nonce', async () => {
    const address = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('nonce', faker.number.int()).build();
    const estimation = estimationBuilder().build();
    const lastTransaction = multisigTransactionBuilder()
      .with('nonce', faker.number.int({ max: safe.nonce }))
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const chainsUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      // Param ValidationPipe checksums address
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}`;
      const multisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}/multisig-transactions/`;
      if (url === chainsUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === multisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('count', 1)
              .with('results', [multisigTransactionToJson(lastTransaction)])
              .build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.post.mockImplementation(({ url }) => {
      // Param ValidationPipe checksums address
      const estimationsUrl = `${chain.transactionService}/api/v1/safes/${getAddress(address)}/multisig-transactions/estimations/`;
      return url === estimationsUrl
        ? Promise.resolve({ data: rawify(estimation), status: 200 })
        : Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .post(
        `/v2/chains/${chain.chainId}/safes/${address}/multisig-transactions/estimations`,
      )
      .send({
        to: faker.finance.ethereumAddress(),
        value: faker.string.numeric(),
        data: faker.string.hexadecimal({ length: 32 }),
        operation: 0,
      })
      .expect(200)
      .expect({
        currentNonce: safe.nonce,
        recommendedNonce: safe.nonce,
        safeTxGas: estimation.safeTxGas,
      });
  });
});
