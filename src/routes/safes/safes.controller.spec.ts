import { INestApplication } from '@nestjs/common';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import * as request from 'supertest';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { masterCopyBuilder } from '@/domain/chains/entities/__tests__/master-copy.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { faker } from '@faker-js/faker';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  messageBuilder,
  toJson as messageToJson,
} from '@/domain/messages/entities/__tests__/message.builder';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Safes Controller (Unit)', () => {
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

  it('safe info is correctly serialised', async () => {
    const masterCopyVersion = faker.system.semver();
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', masterCopyVersion)
      .build();
    const owner = faker.finance.ethereumAddress();
    const masterCopies = [
      masterCopyBuilder().with('version', masterCopyVersion).build(),
    ];
    const masterCopyInfo = contractBuilder()
      .with('address', masterCopies[0].address)
      .build();
    const safeInfo = safeBuilder()
      .with('owners', [owner])
      .with('masterCopy', masterCopies[0].address)
      .with('version', masterCopyVersion)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();

    const moduleTransactions = pageBuilder()
      .with('results', [
        moduleTransactionToJson(
          moduleTransactionBuilder()
            .with('executionDate', new Date('2073-03-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    const messages = pageBuilder()
      .with('results', [
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-03-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                erc721TransferToJson(
                  erc721TransferBuilder()
                    .with('executionDate', new Date('2016-09-19T02:55:04+0000'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2049-01-30T14:23:07Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect({
        address: {
          value: safeInfo.address,
          name: null,
          logoUri: null,
        },
        chainId: chain.chainId,
        nonce: safeInfo.nonce,
        threshold: safeInfo.threshold,
        owners: [
          {
            value: owner,
            name: null,
            logoUri: null,
          },
        ],
        implementation: {
          value: masterCopyInfo.address,
          name: masterCopyInfo.displayName,
          logoUri: masterCopyInfo.logoUri,
        },
        implementationVersionState: 'UP_TO_DATE',
        collectiblesTag: '1474253704',
        txQueuedTag: '2495629387',
        txHistoryTag: '3256547346',
        messagesTag: '1678624146',
        modules: null,
        fallbackHandler: {
          value: fallbackHandlerInfo.address,
          name: fallbackHandlerInfo.displayName,
          logoUri: fallbackHandlerInfo.logoUri,
        },
        guard: {
          value: guardInfo.address,
          name: guardInfo.displayName,
          logoUri: guardInfo.logoUri,
        },
        version: safeInfo.version,
      });
  });

  it('Version State is UNKNOWN when safe version is null', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .with('version', null)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN when safe has an invalid safe version', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .with('version', 'vI.N.V.A.L.I.D')
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN when chain has an invalid recommended safe version', async () => {
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', 'vI.N.V.A.L.I.D')
      .build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN if master copy is not supported', async () => {
    const chain = chainBuilder().build();
    const supportedMasterCopy = faker.finance.ethereumAddress();
    const masterCopies = [
      masterCopyBuilder().with('address', supportedMasterCopy).build(),
    ];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is OUTDATED if safe version is not recommended', async () => {
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', '5.0.0')
      .build();
    const supportedMasterCopy = faker.finance.ethereumAddress();
    const masterCopies = [
      masterCopyBuilder().with('address', supportedMasterCopy).build(),
    ];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', supportedMasterCopy)
      .with('version', '4.0.0')
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'OUTDATED',
        }),
      );
  });

  it('txQueuedTag is computed from Multisig transaction with modified date', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-18T03:52:02Z'))
                    .build(),
                ),
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-16T03:52:02Z'))
                    .build(),
                ),
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-14T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txQueuedTag: '1600401122',
        }),
      );
  });

  it('txQueuedTag is now if there are no Multisig transactions', async () => {
    jest.useFakeTimers();

    const date = faker.date.anytime();
    jest.setSystemTime(date);

    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: multisigTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txQueuedTag: Math.floor(date.getTime() / 1000).toString(),
        }),
      );

    jest.useRealTimers();
  });

  it('txQueuedTag is now if Multisig transactions throw', async () => {
    jest.useFakeTimers();

    const date = faker.date.anytime();
    jest.setSystemTime(date);

    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txQueuedTag: Math.floor(date.getTime() / 1000).toString(),
        }),
      );

    jest.useRealTimers();
  });

  it('collectiblesTag is computed from Ethereum transaction with executionDate date', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder()
      .with('results', [
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2020-09-18T03:52:02Z'))
            .build(),
        ),
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2020-09-16T03:52:02Z'))
            .build(),
        ),
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2020-09-14T03:52:02Z'))
            .build(),
        ),
      ])
      .build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: multisigTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          collectiblesTag: '1600401122',
        }),
      );
  });

  it('collectiblesTag is now if there are no Ethereum transactions', async () => {
    jest.useFakeTimers();

    const date = faker.date.anytime();
    jest.setSystemTime(date);

    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: multisigTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          collectiblesTag: Math.floor(date.getTime() / 1000).toString(),
        }),
      );

    jest.useRealTimers();
  });

  it('collectiblesTag is now if Ethereum transactions throw', async () => {
    jest.useFakeTimers();

    const date = faker.date.anytime();
    jest.setSystemTime(date);

    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const multisigTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: multisigTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          collectiblesTag: Math.floor(date.getTime() / 1000).toString(),
        }),
      );

    jest.useRealTimers();
  });

  it('txHistoryTag is computed from Multisig transaction with modified date', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-18T03:52:02Z'))
                    .build(),
                ),
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-16T03:52:02Z'))
                    .build(),
                ),
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-14T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600401122',
        }),
      );
  });

  it('txHistoryTag is computed from Multisig transaction without modified date', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', null)
                    .with('submissionDate', new Date('2020-09-17T03:52:02Z'))
                    .build(),
                ),
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-16T03:52:02Z'))
                    .with('submissionDate', new Date('2020-09-16T03:52:02Z'))
                    .build(),
                ),
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-14T03:52:02Z'))
                    .with('submissionDate', new Date('2020-09-14T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Ethereum transaction', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                erc721TransferToJson(
                  erc721TransferBuilder()
                    .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-16T03:52:02Z'))
                    .with('submissionDate', new Date('2020-09-16T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Module transaction', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: pageBuilder().build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                multisigTransactionToJson(
                  multisigTransactionBuilder()
                    .with('modified', new Date('2020-09-16T03:52:02Z'))
                    .with('submissionDate', new Date('2020-09-16T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                moduleTransactionToJson(
                  moduleTransactionBuilder()
                    .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is now if there are no Multisig/Ethereum/Module transactions', async () => {
    jest.useFakeTimers();

    const date = faker.date.anytime();
    jest.setSystemTime(date);

    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: multisigTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: Math.floor(date.getTime() / 1000).toString(),
        }),
      );

    jest.useRealTimers();
  });

  it('txHistoryTag is computed from Ethereum transaction if Multisig transactions throw', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                erc721TransferToJson(
                  erc721TransferBuilder()
                    .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: pageBuilder().build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Module transaction if Multisig/Ethereum transactions throw', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: pageBuilder()
              .with('results', [
                moduleTransactionToJson(
                  moduleTransactionBuilder()
                    .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                    .build(),
                ),
              ])
              .build(),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is now if Multisig/Ethereum/Module transactions throw', async () => {
    jest.useFakeTimers();

    const date = faker.date.anytime();
    jest.setSystemTime(date);

    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: Math.floor(date.getTime() / 1000).toString(),
        }),
      );

    jest.useRealTimers();
  });

  it('messagesTag is the latest modified timestamp', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();

    const messages = pageBuilder()
      .with('results', [
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-03-12T12:29:06Z'))
            .build(),
        ),
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-07-12T12:29:06Z'))
            .build(),
        ),
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-02-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          messagesTag: '1689164946',
        }),
      );
  });

  it('modules are computed with the respective address info', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const module1 = faker.finance.ethereumAddress();
    const module2 = faker.finance.ethereumAddress();
    const module3 = faker.finance.ethereumAddress();
    const safeInfo = safeBuilder()
      .with('masterCopy', masterCopyInfo.address)
      .with('modules', [module1, module2, module3])
      .build();
    const moduleInfo1 = contractBuilder().with('address', module1).build();
    const moduleInfo2 = contractBuilder().with('address', module2).build();
    const moduleInfo3 = contractBuilder().with('address', module3).build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${module1}`:
          return Promise.resolve({ data: moduleInfo1, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${module2}`:
          return Promise.resolve({ data: moduleInfo2, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${module3}`:
          return Promise.resolve({ data: moduleInfo3, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          modules: [
            {
              logoUri: moduleInfo1.logoUri,
              name: moduleInfo1.displayName,
              value: moduleInfo1.address,
            },
            {
              logoUri: moduleInfo2.logoUri,
              name: moduleInfo2.displayName,
              value: moduleInfo2.address,
            },
            {
              logoUri: moduleInfo3.logoUri,
              name: moduleInfo3.displayName,
              value: moduleInfo3.address,
            },
          ],
        }),
      );
  });

  it('modules are null when module collection is empty', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('modules', [])
      .with('masterCopy', masterCopyInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          modules: null,
        }),
      );
  });

  it('fallback handler guard returns null if it is a null address', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('fallbackHandler', NULL_ADDRESS)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${safeInfo.fallbackHandler}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          fallbackHandler: null,
        }),
      );
  });

  it('fallback handler is serialised if there is no address info', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${safeInfo.fallbackHandler}`:
          // Return 404 for Fallback Handler Info
          return Promise.reject({ status: 404 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          fallbackHandler: {
            value: safeInfo.fallbackHandler,
            name: null,
            logoUri: null,
          },
        }),
      );
  });

  it('guard returns null if it is a null address', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().with('guard', NULL_ADDRESS).build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({ data: fallbackHandlerInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: guardInfo, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          guard: null,
        }),
      );
  });

  it('guard is serialised if there is no address info', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: safeInfo, status: 200 });
        case `${chain.transactionService}/api/v1/about/master-copies/`:
          return Promise.resolve({ data: masterCopies, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${masterCopyInfo.address}`:
          return Promise.resolve({ data: masterCopyInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${safeInfo.fallbackHandler}`:
          return Promise.resolve({ data: fallbackInfo, status: 200 });
        case `${chain.transactionService}/api/v1/contracts/${guardInfo.address}`:
          // Return 404 for Guard Info
          return Promise.reject({ status: 404 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({ data: collectibleTransfers, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({ data: queuedTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({ data: moduleTransactions, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: messages, status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          guard: {
            value: safeInfo.guard,
            name: null,
            logoUri: null,
          },
        }),
      );
  });
});
