import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import type { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Delete Transaction - Transactions Controller (Unit', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let fakeCacheService: FakeCacheService;

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
    fakeCacheService = moduleFixture.get(CacheService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 16 });
    const invalidDeleteTransactionDto = {
      signature: faker.number.int(),
    };

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chainId}/transactions/${safeTxHash}`)
      .send(invalidDeleteTransactionDto)
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['signature'],
        message: 'Expected string, received number',
      });
  });

  it('should delete a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const tx = multisigTransactionBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`
      ) {
        return Promise.resolve({
          data: rawify(multisigToJson(tx)),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation(({ url }) => {
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}`
      ) {
        return Promise.resolve({ data: rawify({}), status: 204 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);
  });

  it('should clear the cache after deleting a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const tx = multisigTransactionBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`
      ) {
        return Promise.resolve({
          data: rawify(multisigToJson(tx)),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation(({ url }) => {
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}`
      ) {
        return Promise.resolve({ data: rawify({}), status: 204 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);

    await expect(
      fakeCacheService.hGet(
        new CacheDir(
          `${chain.chainId}_multisig_transaction_${tx.safeTxHash}`,
          '',
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      fakeCacheService.hGet(
        new CacheDir(`${chain.chainId}_multisig_transactions_${tx.safe}`, ''),
      ),
    ).resolves.toBeUndefined();
  });

  it('should forward an error from the Transaction Service', async () => {
    const chain = chainBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    const tx = multisigTransactionBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`
      ) {
        return Promise.resolve({
          data: rawify(multisigToJson(tx)),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation(({ url }) => {
      if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}`
      ) {
        return Promise.reject(
          new NetworkResponseError(
            new URL(safeConfigUrl),
            {
              status: 404,
            } as Response,
            { message: 'Transaction not found', status: 404 },
          ),
        );
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(404)
      .expect({
        message: 'Transaction not found',
        code: 404,
      });
  });
});
