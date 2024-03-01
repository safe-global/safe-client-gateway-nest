import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';

describe('Delete Transaction - Transactions Controller (Unit', () => {
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

  it('should throw a validation error', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 16 });
    const invalidDeleteTransactionDto = {
      signature: faker.number.int(),
    };

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chainId}/transactions/${safeTxHash}`)
      .send(invalidDeleteTransactionDto)
      .expect(400)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('should delete a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const safeTxHash = faker.string.hexadecimal({ length: 16 });
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    networkService.get.mockImplementation((url) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      fail(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation((url) => {
      if (
        url === `${chain.transactionService}/api/v1/transactions/${safeTxHash}`
      ) {
        return Promise.resolve({ data: {}, status: 204 });
      }
      fail(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);
  });

  it('should forward an error from the Transaction Service', async () => {
    const chain = chainBuilder().build();
    const safeTxHash = faker.string.hexadecimal({ length: 16 });
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    networkService.get.mockImplementation((url) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      fail(`No matching rule for url: ${url}`);
    });
    networkService.delete.mockImplementation((url) => {
      if (
        url === `${chain.transactionService}/api/v1/transactions/${safeTxHash}`
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
      fail(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(404)
      .expect({
        message: 'Transaction not found',
        code: 404,
      });
  });
});
