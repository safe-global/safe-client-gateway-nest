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
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TransactionsModule } from '@/routes/transactions/transactions.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { addConfirmationDtoBuilder } from '@/routes/transactions/__tests__/entities/add-confirmation.dto.builder';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';

describe('Add transaction confirmations - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
        // common
        TestCacheModule,
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
      ],
    }).compile();

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
    await request(app.getHttpServer())
      .post(
        `/v1/chains/${faker.string.numeric()}/transactions/${faker.string.hexadecimal()}/confirmations`,
      )
      .send({ signedSafeTxHash: 1 });
  });

  it('should create a confirmation and return the updated transaction', async () => {
    const chain = chainBuilder().build();
    const safeTxHash = faker.string.hexadecimal({ length: 32 });
    const addConfirmationDto = addConfirmationDtoBuilder().build();
    const safeApps = [safeAppBuilder().build()];
    const contract = contractBuilder().build();
    const transaction = multisigToJson(
      multisigTransactionBuilder()
        .with('safe', getAddress(faker.finance.ethereumAddress()))
        .build(),
    ) as MultisigTransaction;
    const safe = safeBuilder()
      .with('address', getAddress(transaction.safe))
      .build();
    const gasToken = tokenBuilder().build();
    const token = tokenBuilder().build();
    const rejectionTxsPage = pageBuilder().with('results', []).build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${safeTxHash}/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${transaction.safe}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${transaction.gasToken}`;
      const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${transaction.to}`;
      const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${transaction.to}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({ data: rawify(transaction), status: 200 });
        case getMultisigTransactionsUrl:
          return Promise.resolve({
            data: rawify(rejectionTxsPage),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: rawify(safeApps), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getToTokenUrl:
          return Promise.resolve({ data: rawify(token), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    networkService.post.mockImplementation(({ url }) => {
      const postConfirmationUrl = `${chain.transactionService}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
      switch (url) {
        case postConfirmationUrl:
          return Promise.resolve({ data: rawify({}), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/transactions/${safeTxHash}/confirmations`,
      )
      .send(addConfirmationDto)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${transaction.safe}_${transaction.safeTxHash}`,
          executedAt: expect.any(Number),
          txStatus: expect.any(String),
          txInfo: expect.any(Object),
          txData: expect.any(Object),
          txHash: transaction.transactionHash,
          detailedExecutionInfo: expect.any(Object),
          safeAppInfo: expect.any(Object),
        }),
      );
  });
});
