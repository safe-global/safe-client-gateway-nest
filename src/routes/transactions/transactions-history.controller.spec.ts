import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  creationTransactionBuilder,
  toJson as creationTransactionToJson,
} from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import {
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '@/domain/safe/entities/__tests__/ethereum-transaction.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenType } from '@/domain/tokens/entities/token.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';

describe('Transactions History Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const testConfiguration: typeof configuration = () => ({
      ...configuration(),
      mappings: {
        history: {
          maxNestedTransfers: 5,
        },
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
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
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      if (url === getChainUrl) {
        const error = new NetworkResponseError(new URL(getChainUrl), {
          status: 500,
        } as Response);
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });
  });

  it('Failure: Transaction API fails', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        const error = new NetworkResponseError(new URL(getAllTransactions), {
          status: 500,
        } as Response);
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });
  });

  it('Failure: data page validation fails', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chain = chainBuilder().build();
    const page = pageBuilder().build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: { ...page, results: faker.word.words() },
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/transactions/history/`,
      )
      .expect(500)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('Should return only creation transaction', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 3600 * 2; //Offset of 2 hours
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
    const creationTransaction = creationTransactionBuilder().build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getSafeCreationUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/creation/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      if (url === getSafeCreationUrl) {
        return Promise.resolve({
          data: creationTransactionToJson(creationTransaction),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?timezone_offset=${timezoneOffset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(2);
        expect(body.results[1].transaction.id).toContain('creation_');
      });
  });

  it('Should return correctly each date label', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const moduleTransaction = moduleTransactionToJson(
      moduleTransactionBuilder()
        .with('dataDecoded', null)
        .with('executionDate', new Date('2022-12-06T23:00:00Z'))
        .build(),
    );
    const multisigTransaction = multisigTransactionToJson(
      multisigTransactionBuilder()
        .with('dataDecoded', null)
        .with('origin', null)
        .with('executionDate', new Date('2022-12-25T00:00:00Z'))
        .build(),
    );
    const nativeTokenTransfer = nativeTokenTransferBuilder().build();
    const incomingTransaction = ethereumTransactionToJson(
      ethereumTransactionBuilder()
        .with('executionDate', new Date('2022-12-31T00:00:00Z'))
        .with('transfers', [
          nativeTokenTransferToJson(nativeTokenTransfer) as Transfer,
        ])
        .build(),
    );
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [moduleTransaction, multisigTransaction, incomingTransaction],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(
          6, //3 date labels and 3 transactions
        );
        expect(body.results[0].timestamp).toEqual(
          1670367600000, // Date('2022-12-06T23:00:00Z').getTime()
        );
        expect(body.results[2].timestamp).toEqual(
          1671926400000, // Date('2022-12-25T00:00:00Z').getTime()
        );
        expect(body.results[4].timestamp).toEqual(
          1672444800000, // Date('2022-12-31T00:00:00Z').getTime(),
        );
      });
  });

  it('Should not change date label with time offset', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 2 * 60 * 60 * 1000 + 1; // 2 hours in milliseconds + 1 millisecond to test precision of offsetting
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction = moduleTransactionToJson(
      moduleTransactionBuilder()
        .with('dataDecoded', null)
        .with('executionDate', new Date('2022-12-31T22:09:36Z'))
        .build(),
    );
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [moduleTransaction],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?timezone_offset=${timezoneOffset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(2);
        expect(body.results[0].timestamp).toEqual(
          new Date('2022-12-31T22:09:36Z').getTime(),
        );
      });
  });

  it('Should group transactions according to timezone offset', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const timezoneOffset = 60 * 60 * 1000; // 1 hour in milliseconds
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction1 = moduleTransactionBuilder()
      .with('dataDecoded', null)
      .with('executionDate', new Date('2022-12-31T21:09:36Z'))
      .build();
    const moduleTransaction2 = moduleTransactionBuilder()
      .with('dataDecoded', null)
      .with('executionDate', new Date('2022-12-31T23:09:36Z'))
      .build();
    const safe = safeBuilder().build();
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=10&offset=10&queued=true&trusted=true`,
      previous: null,
      results: [
        moduleTransactionToJson(moduleTransaction2),
        moduleTransactionToJson(moduleTransaction1),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?timezone_offset=${timezoneOffset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(4);
        // Top group represents the header with the time shifted (January 1, 2023)
        // Note that the value of the header should still be in UTC
        expect(body.results[0].timestamp).toEqual(
          new Date('2022-12-31T23:09:36Z').getTime(),
        );
        // The timezone offset should not change the time of the transaction (i.e. UTC should still be used)
        expect(body.results[1].transaction.timestamp).toEqual(
          moduleTransaction2.executionDate.getTime(),
        );
        // Followup group represents the header with the time shifted (December 31, 2022)
        expect(body.results[2].timestamp).toEqual(
          new Date('2022-12-31T21:09:36Z').getTime(),
        );
        // The timezone offset should not change the time of the transaction (i.e. UTC should still be used)
        expect(body.results[3].transaction.timestamp).toEqual(
          moduleTransaction1.executionDate.getTime(),
        );
      });
  });

  it('Should return correctly each transaction', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const moduleTransaction = moduleTransactionBuilder()
      .with('executionDate', new Date('2022-12-14T13:19:12Z'))
      .with('safe', safe.address)
      .with('isSuccessful', true)
      .with('data', null)
      .with('operation', 0)
      .with('value', faker.number.int({ min: 1 }).toString())
      .with('moduleTransactionId', 'i5a6754140f0432d3b')
      .build();
    const multisigTransactionToAddress = faker.finance.ethereumAddress();
    const multisigTransactionValue = faker.string.numeric();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('value', '0')
      .with('operation', 0)
      .with('safeTxGas', 0)
      .with('executionDate', new Date('2022-11-16T07:31:11Z'))
      .with('submissionDate', new Date('2022-11-16T07:29:56.401601Z'))
      .with('safeTxHash', '0x31d44c67')
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('origin', null)
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'transfer')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('name', 'to')
              .with('type', 'address')
              .with('value', multisigTransactionToAddress)
              .build(),
            dataDecodedParameterBuilder()
              .with('name', 'value')
              .with('type', 'uint256')
              .with('value', multisigTransactionValue)
              .build(),
          ])
          .build(),
      )
      .with('confirmationsRequired', 2)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .build();

    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('transferId', 'e1015fc6905859c69')
      .build();
    const incomingTransaction = ethereumTransactionBuilder()
      .with('transfers', [
        nativeTokenTransferToJson(nativeTokenTransfer) as Transfer,
      ])
      .build();
    const tokenResponse = tokenBuilder()
      .with('type', TokenType.Erc20)
      .with('address', multisigTransaction.to)
      .build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${multisigTransaction.to}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [
              moduleTransactionToJson(moduleTransaction),
              multisigTransactionToJson(multisigTransaction),
              ethereumTransactionToJson(incomingTransaction),
            ])
            .build(),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: tokenResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'DATE_LABEL',
              timestamp: expect.any(Number),
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `module_${safe.address}_i5a6754140f0432d3b`,
                safeAppInfo: null,
                timestamp: moduleTransaction.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: moduleTransaction.safe },
                  recipient: { value: moduleTransaction.to },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: moduleTransaction.value,
                  },
                },
                executionInfo: {
                  type: 'MODULE',
                  address: { value: moduleTransaction.module },
                },
              },
              conflictType: 'None',
            },
            {
              type: 'DATE_LABEL',
              timestamp: expect.any(Number),
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_0x31d44c67`,
                timestamp: 1668583871000,
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: multisigTransaction.safe },
                  recipient: { value: multisigTransactionToAddress },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: multisigTransaction.to,
                    tokenName: tokenResponse.name,
                    tokenSymbol: tokenResponse.symbol,
                    logoUri: tokenResponse.logoUri,
                    decimals: tokenResponse.decimals,
                    value: multisigTransactionValue,
                  },
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: multisigTransaction.nonce,
                  confirmationsRequired: 2,
                  confirmationsSubmitted: 2,
                  missingSigners: null,
                },
                safeAppInfo: null,
              },
              conflictType: 'None',
            },
            {
              type: 'DATE_LABEL',
              timestamp: expect.any(Number),
            },
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_e1015fc6905859c69`,
                executionInfo: null,
                safeAppInfo: null,
                timestamp: nativeTokenTransfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: nativeTokenTransfer.from },
                  recipient: { value: nativeTokenTransfer.to },
                  direction: 'INCOMING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: nativeTokenTransfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should include safe creation transaction', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const moduleTransaction = moduleTransactionBuilder()
      .with('dataDecoded', null)
      .build();
    const safe = safeBuilder().build();
    const allTransactionsResponse = {
      count: 2,
      next: null,
      previous: null,
      results: [moduleTransactionToJson(moduleTransaction)],
    };
    const creationTransaction = creationTransactionBuilder()
      .with('created', new Date(moduleTransaction.executionDate))
      .build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrl = `${chainResponse.transactionService}/api/v1/contracts/`;
      const getSafeCreationUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/creation/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: allTransactionsResponse,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({
          data: safe,
          status: 200,
        });
      }
      if (url === getSafeCreationUrl) {
        return Promise.resolve({
          data: creationTransactionToJson(creationTransaction),
          status: 200,
        });
      }
      if (url.includes(getContractUrl)) {
        const error = new NetworkResponseError(
          new URL(getContractUrl),
          {
            status: 404,
          } as Response,
          { detail: 'Not found' },
        );
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/`)
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(3);
        expect(body.results[2].transaction.timestamp).toEqual(
          creationTransaction.created.getTime(),
        );
        expect(body.results[2].transaction.txInfo.creator.value).toEqual(
          creationTransaction.creator,
        );
        expect(body.results[2].transaction.txInfo.factory.value).toEqual(
          creationTransaction.factoryAddress,
        );
        expect(body.results[2].transaction.txInfo.implementation.value).toEqual(
          creationTransaction.masterCopy,
        );
        expect(body.results[2].transaction.txInfo.transactionHash).toEqual(
          creationTransaction.transactionHash,
        );
      });
  });

  it('Should keep the client pagination', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().build();
    const chainId = chainResponse.chainId;
    const limit = 5;
    const offset = 5;
    const moduleTransaction = moduleTransactionToJson(
      moduleTransactionBuilder().with('dataDecoded', null).build(),
    );
    const safe = safeBuilder().build();
    const clientNextCursor = `cursor=limit%3D${limit}%26offset%3D10`;
    const clientPreviousCursor = `cursor=limit%3D${limit}%26offset%3D0`;
    const transactionHistoryBuilder = {
      count: 40,
      next: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=6&offset=10&queued=true&trusted=true`,
      previous: `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/?executed=false&limit=6&queued=true&trusted=true`,
      results: [moduleTransaction],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getAllTransactions = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getAllTransactions) {
        return Promise.resolve({
          data: transactionHistoryBuilder,
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/transactions/history/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.next).toContain(clientNextCursor);
        expect(body.previous).toContain(clientPreviousCursor);
      });

    expect(networkService.get).toHaveBeenCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
    expect(networkService.get).toHaveBeenCalledWith(
      `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/all-transactions/`,
      {
        params: {
          executed: true,
          offset: offset - 1,
          limit: limit + 1,
          ordering: undefined,
          queued: false,
          safe: safeAddress,
        },
      },
    );
  });

  it('Should limit the amount of nested transfers', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const maxNestedTransfers = app
      .get(IConfigurationService)
      .getOrThrow('mappings.history.maxNestedTransfers');
    const date = new Date();
    const transfers = faker.helpers.multiple(
      () =>
        nativeTokenTransferToJson(
          nativeTokenTransferBuilder().with('executionDate', date).build(),
        ) as Transfer,
      // the amount of transfers is the double of the max value
      { count: maxNestedTransfers * 2 },
    );
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history/`,
      )
      .expect(200)
      .then(({ body }) => {
        // the amount of TransactionItems is limited to the max value
        expect(
          body.results.filter(
            (item: TransactionItem) => item.type === 'TRANSACTION',
          ),
        ).toHaveLength(maxNestedTransfers);
      });
  });

  it('Untrusted token transfers are ignored by default', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', untrustedToken.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(2);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('Should return an empty array with no date labels if all the token transfers are untrusted', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const oneDayAfter = new Date(date.getTime() + 1000 * 60 * 60 * 24);
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', date)
            .build(),
        ),
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', oneDayAfter)
            .build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // Empty array
        expect(response.body['results']).toEqual([]);
      });
  });

  it('Should not return a date label if all the token transfers for that date are untrusted', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const oneDayAfter = new Date(date.getTime() + 1000 * 60 * 60 * 24);
    const twoDaysAfter = new Date(date.getTime() + 1000 * 60 * 60 * 48);
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', trustedToken.address)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', date)
            .build(),
        ),
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', untrustedToken.address)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', oneDayAfter)
            .build(),
        ),
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('transfers', [
              erc20TransferToJson(
                erc20TransferBuilder()
                  .with('tokenAddress', trustedToken.address)
                  .build(),
              ) as Transfer,
            ])
            .with('executionDate', twoDaysAfter)
            .build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // Two date labels and two transactions
        expect(response.body['results']).toHaveLength(4);
        expect(response.body['results'][0]).toMatchObject({
          type: 'DATE_LABEL',
        });
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
        expect(response.body['results'][2]).toMatchObject({
          type: 'DATE_LABEL',
        });
        expect(response.body['results'][3]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('Untrusted transfers are returned when trusted=false', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const untrustedToken = tokenBuilder().with('trusted', false).build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', untrustedToken.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${untrustedToken.address}`:
          return Promise.resolve({ data: untrustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(3);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: untrustedToken.address,
              },
            },
          },
        });
        expect(response.body['results'][2]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('Nested transfers with a value of zero are not returned', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const trustedToken = tokenBuilder().with('trusted', true).build();
    // Use same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .with('value', '1')
          .build(),
      ) as Transfer,
      erc20TransferToJson(
        erc20TransferBuilder()
          .with('tokenAddress', trustedToken.address)
          .with('executionDate', date)
          .with('value', '0')
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedToken.address}`:
          return Promise.resolve({ data: trustedToken, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(2);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                value: '1',
                tokenAddress: trustedToken.address,
              },
            },
          },
        });
      });
  });

  it('ERC721 transfers marked as non-trusted are returned', async () => {
    const safe = safeBuilder().build();
    const chain = chainBuilder().build();
    const notTrustedErc721 = tokenBuilder()
      .with('trusted', false)
      .with('type', TokenType.Erc721)
      .build();
    const trustedErc721 = tokenBuilder()
      .with('trusted', true)
      .with('type', TokenType.Erc721)
      .build();
    // Use the same date so that groups are created deterministically
    const date = faker.date.recent();
    const transfers = [
      erc721TransferToJson(
        erc721TransferBuilder()
          .with('tokenAddress', notTrustedErc721.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
      erc721TransferToJson(
        erc721TransferBuilder()
          .with('tokenAddress', trustedErc721.address)
          .with('executionDate', date)
          .build(),
      ) as Transfer,
    ];
    const transactionHistoryData = {
      count: faker.number.int(),
      next: faker.internet.url(),
      previous: faker.internet.url(),
      results: [
        ethereumTransactionToJson(
          ethereumTransactionBuilder().with('transfers', transfers).build(),
        ),
      ],
    };
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getAllTransactions = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getAllTransactions:
          return Promise.resolve({ data: transactionHistoryData, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${trustedErc721.address}`:
          return Promise.resolve({ data: trustedErc721, status: 200 });
        case `${chain.transactionService}/api/v1/tokens/${notTrustedErc721.address}`:
          return Promise.resolve({ data: notTrustedErc721, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history`,
      )
      .expect(200)
      .expect((response) => {
        // One date label and one transaction
        expect(response.body['results']).toHaveLength(3);
        expect(response.body['results'][1]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: notTrustedErc721.address,
              },
            },
          },
        });
        expect(response.body['results'][2]).toMatchObject({
          transaction: {
            txInfo: {
              transferInfo: {
                tokenAddress: trustedErc721.address,
              },
            },
          },
        });
      });
  });
});
