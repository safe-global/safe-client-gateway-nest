import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { proposeTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/propose-transaction.dto.builder';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
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

describe('Propose transaction - Transactions Controller (Unit)', () => {
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

  it('should throw a validation error', async () => {
    const safeAddress = faker.string.numeric();
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();
    const { safeTxHash } = proposeTransactionDto;
    await request(app.getHttpServer())
      .post(`/v1/chains/${safeAddress}/transactions/${safeTxHash}/propose`)
      .send({ ...proposeTransactionDto, value: 1 })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['value'],
        message: 'Expected string, received number',
      });
  });

  it('should propose a transaction', async () => {
    const proposeTransactionDto = proposeTransactionDtoBuilder().build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().with('address', safeAddress).build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safeAddress)
      .build();
    const transactions = pageBuilder().build();
    const token = tokenBuilder().build();
    const gasToken = tokenBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${proposeTransactionDto.safeTxHash}/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      const getTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
      const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(transaction)),
            status: 200,
          });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rawify(transactions), status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: rawify(safeApps), status: 200 });
        case getContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getTokenUrl:
          return Promise.resolve({ data: rawify(token), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    networkService.post.mockImplementation(({ url }) => {
      const proposeTransactionUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      switch (url) {
        case proposeTransactionUrl:
          return Promise.resolve({ data: rawify({}), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/propose`)
      .send(proposeTransactionDto)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.objectContaining({
            txId: `multisig_${safeAddress}_${transaction.safeTxHash}`,
            executedAt: transaction.executionDate?.getTime(),
            txStatus: expect.any(String),
            txInfo: expect.any(Object),
            detailedExecutionInfo: expect.objectContaining({
              type: 'MULTISIG',
              nonce: transaction.nonce,
            }),
            safeAppInfo: expect.any(Object),
            safeAddress,
            txHash: transaction.transactionHash,
          }),
        ),
      );
  });
});
