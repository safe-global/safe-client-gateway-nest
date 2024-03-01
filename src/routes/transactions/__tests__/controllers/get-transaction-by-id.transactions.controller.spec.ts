import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { CALL_OPERATION } from '@/domain/safe/entities/operation.entity';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
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
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Get by id - Transactions Controller (Unit)', () => {
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
    const id = `module_${faker.string.uuid()}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
    networkService.get.mockImplementation((url) => {
      if (url === getChainUrl) {
        const error = new NetworkResponseError(new URL(getChainUrl), {
          status: 500,
        } as Response);
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/transactions/${id}`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith(getChainUrl, undefined);
  });

  it('Failure: Transaction API fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const moduleTransactionId = faker.string.uuid();
    const getModuleTransactionUrl = `${chain.transactionService}/api/v1/module-transaction/${moduleTransactionId}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getModuleTransactionUrl:
          const error = new NetworkResponseError(
            new URL(getModuleTransactionUrl),
            {
              status: 500,
            } as Response,
          );
          return Promise.reject(error);
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/module_${safe.address}_${moduleTransactionId}`,
      )
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith(getChainUrl, undefined);
    expect(networkService.get).toHaveBeenCalledWith(
      getModuleTransactionUrl,
      undefined,
    );
  });

  it('Get module transaction by ID should return 404', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const id = faker.string.uuid();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getModuleTransactionUrl = `${chain.transactionService}/api/v1/module-transaction/${id}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getModuleTransactionUrl:
          const error = new NetworkResponseError(
            new URL(getModuleTransactionUrl),
            {
              status: 404,
            } as Response,
          );
          return Promise.reject(error);
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/module_${safe.address}_${id}`,
      )
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });
  });

  it('Get module transaction by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const contract = contractBuilder()
      .with('trustedForDelegateCall', false)
      .build();
    const moduleTransactionId = faker.string.uuid();
    const moduleTransaction = moduleTransactionBuilder()
      .with('safe', safe.address)
      .with('data', null)
      .with('value', '0xf')
      .with('operation', CALL_OPERATION)
      .with('isSuccessful', true)
      .build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getModuleTransactionUrl = `${chain.transactionService}/api/v1/module-transaction/${moduleTransactionId}`;
    const getContractUrl = `${chain.transactionService}/api/v1/contracts/${moduleTransaction.to}`;
    const getModuleContractUrl = `${chain.transactionService}/api/v1/contracts/${moduleTransaction.module}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getModuleTransactionUrl:
          return Promise.resolve({
            data: moduleTransactionToJson(moduleTransaction),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        case getModuleContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/module_${safe.address}_${moduleTransactionId}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          safeAddress: safe.address,
          txId: `module_${safe.address}_${moduleTransaction.moduleTransactionId}`,
          executedAt: moduleTransaction.executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Transfer',
            sender: expect.objectContaining({ value: safe.address }),
            recipient: expect.objectContaining({ value: contract.address }),
            direction: 'OUTGOING',
            transferInfo: {
              type: 'NATIVE_COIN',
              value: moduleTransaction.value,
            },
            humanDescription: null,
            richDecodedInfo: null,
          },
          txData: {
            to: expect.objectContaining({ value: contract.address }),
            value: moduleTransaction.value,
            hexData: moduleTransaction.data,
            dataDecoded: moduleTransaction.dataDecoded,
            operation: CALL_OPERATION,
            addressInfoIndex: null,
            trustedDelegateCallTarget: null,
          },
          detailedExecutionInfo: {
            type: 'MODULE',
            address: expect.objectContaining({ value: contract.address }),
          },
          txHash: moduleTransaction.transactionHash,
          safeAppInfo: null,
        });
      });
  });

  it('Get an ERC20 transfer by ID should return 404', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const id = faker.string.uuid();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getTransferUrl = `${chain.transactionService}/api/v1/transfer/${id}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getTransferUrl: {
          const error = new NetworkResponseError(new URL(getTransferUrl), {
            status: 404,
          } as Response);
          return Promise.reject(error);
        }
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/transfer_${safe.address}_${id}`,
      )
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });
  });

  it('Get an native token transfer by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const contract = contractBuilder().build();
    const transferId = faker.string.uuid();
    const transfer = nativeTokenTransferBuilder()
      .with('transferId', transferId)
      .with('to', safe.address)
      .build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getTransferUrl = `${chain.transactionService}/api/v1/transfer/${transferId}`;
    const getFromContractUrl = `${chain.transactionService}/api/v1/contracts/${transfer.from}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${transfer.to}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getTransferUrl:
          return Promise.resolve({
            data: nativeTokenTransferToJson(transfer),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getFromContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/transfer_${safe.address}_${transferId}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `transfer_${safe.address}_${transfer.transferId}`,
          executedAt: transfer.executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Transfer',
            sender: expect.objectContaining({ value: contract.address }),
            recipient: expect.objectContaining({ value: contract.address }),
            direction: 'INCOMING',
            transferInfo: {
              type: 'NATIVE_COIN',
              value: transfer.value,
            },
          },
          txData: null,
          detailedExecutionInfo: null,
          txHash: transfer.transactionHash,
          safeAppInfo: null,
        });
      });
  });

  it('Get an Multisig Transaction by ID should return 404', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const txHash = faker.string.hexadecimal();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${txHash}/`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getMultisigTransactionUrl: {
          const error = new NetworkResponseError(
            new URL(getMultisigTransactionUrl),
            {
              status: 404,
            } as Response,
          );
          return Promise.reject(error);
        }
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${txHash}`,
      )
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });
  });

  it('Get an Multisig Transaction by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safeOwners = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const safe = safeBuilder().with('owners', safeOwners).build();
    const contract = contractBuilder().build();
    const executionDate = faker.date.recent();
    const safeTxGas = faker.number.int();
    const gasPrice = faker.string.hexadecimal();
    const baseGas = faker.number.int();
    const confirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const tx = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('operation', 0)
      .with('data', faker.string.hexadecimal({ length: 32 }))
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('executionDate', executionDate)
      .with('safeTxGas', safeTxGas)
      .with('gasPrice', gasPrice)
      .with('baseGas', baseGas)
      .with('confirmations', confirmations)
      .build();
    const rejectionTxConfirmations = [confirmationBuilder().build()];
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', rejectionTxConfirmations)
      .build();
    const rejectionTxsPage = pageBuilder()
      .with('results', [multisigToJson(rejectionTx)])
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const gasToken = tokenBuilder().build();
    const token = tokenBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${tx.gasToken}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${tx.to}`;
    const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${tx.to}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({ data: multisigToJson(tx), status: 200 });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rejectionTxsPage, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: gasToken, status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        case getToTokenUrl:
          return Promise.resolve({ data: token, status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: safeAppsResponse, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${tx.safeTxHash}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${safe.address}_${tx.safeTxHash}`,
          executedAt: executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Custom',
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            dataSize: '16',
            value: Number(tx.value).toString(),
            methodName: tx.dataDecoded?.method,
            actionCount: null,
            isCancellation: false,
          },
          txData: {
            hexData: tx.data,
            dataDecoded: tx.dataDecoded,
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            value: tx.value,
            operation: tx.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
          detailedExecutionInfo: {
            type: 'MULTISIG',
            submittedAt: tx.submissionDate.getTime(),
            nonce: tx.nonce,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice,
            refundReceiver: expect.objectContaining({
              value: tx.refundReceiver,
            }),
            safeTxHash: tx.safeTxHash,
            executor: expect.objectContaining({ value: tx.executor }),
            signers: [
              expect.objectContaining({ value: safeOwners[0] }),
              expect.objectContaining({ value: safeOwners[1] }),
            ],
            confirmationsRequired: tx.confirmationsRequired,
            confirmations: [
              {
                signer: expect.objectContaining({
                  value: confirmations[0].owner,
                }),
                signature: confirmations[0].signature,
                submittedAt: confirmations[0].submissionDate.getTime(),
              },
              {
                signer: expect.objectContaining({
                  value: confirmations[1].owner,
                }),
                signature: confirmations[1].signature,
                submittedAt: confirmations[1].submissionDate.getTime(),
              },
            ],
            rejectors: expect.arrayContaining([
              expect.objectContaining({
                value: rejectionTxConfirmations[0].owner,
              }),
            ]),
            gasToken: tx.gasToken,
            gasTokenInfo: gasToken,
            trusted: tx.trusted,
          },
          txHash: tx.transactionHash,
          safeAppInfo: {
            name: safeAppsResponse[0].name,
            url: safeAppsResponse[0].url,
            logoUri: safeAppsResponse[0].iconUrl,
          },
        });
      });
  });

  it('Get an Multisig Transaction by safeTxHash', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safeOwners = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const safe = safeBuilder().with('owners', safeOwners).build();
    const contract = contractBuilder().build();
    const executionDate = faker.date.recent();
    const safeTxGas = faker.number.int();
    const gasPrice = faker.string.hexadecimal();
    const baseGas = faker.number.int();
    const confirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const tx = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('operation', 0)
      .with('data', faker.string.hexadecimal({ length: 32 }))
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('executionDate', executionDate)
      .with('safeTxGas', safeTxGas)
      .with('gasPrice', gasPrice)
      .with('baseGas', baseGas)
      .with('confirmations', confirmations)
      .build();
    const rejectionTxConfirmations = [confirmationBuilder().build()];
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', rejectionTxConfirmations)
      .build();
    const rejectionTxsPage = pageBuilder()
      .with('results', [multisigToJson(rejectionTx)])
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const gasToken = tokenBuilder().build();
    const token = tokenBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getMultisigTransactionUrl = `${
      chain.transactionService
    }/api/v1/multisig-transactions/${tx.safeTxHash.slice(2)}/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${tx.gasToken}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${tx.to}`;
    const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${tx.to}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({ data: multisigToJson(tx), status: 200 });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rejectionTxsPage, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: gasToken, status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        case getToTokenUrl:
          return Promise.resolve({ data: token, status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: safeAppsResponse, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash.slice(2)}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${safe.address}_${tx.safeTxHash}`,
          executedAt: executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Custom',
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            dataSize: '16',
            value: Number(tx.value).toString(),
            methodName: tx.dataDecoded?.method,
            actionCount: null,
            isCancellation: false,
          },
          txData: {
            hexData: tx.data,
            dataDecoded: tx.dataDecoded,
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            value: tx.value,
            operation: tx.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
          detailedExecutionInfo: {
            type: 'MULTISIG',
            submittedAt: tx.submissionDate.getTime(),
            nonce: tx.nonce,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice,
            refundReceiver: expect.objectContaining({
              value: tx.refundReceiver,
            }),
            safeTxHash: tx.safeTxHash,
            executor: expect.objectContaining({ value: tx.executor }),
            signers: [
              expect.objectContaining({ value: safeOwners[0] }),
              expect.objectContaining({ value: safeOwners[1] }),
            ],
            confirmationsRequired: tx.confirmationsRequired,
            confirmations: [
              {
                signer: expect.objectContaining({
                  value: confirmations[0].owner,
                }),
                signature: confirmations[0].signature,
                submittedAt: confirmations[0].submissionDate.getTime(),
              },
              {
                signer: expect.objectContaining({
                  value: confirmations[1].owner,
                }),
                signature: confirmations[1].signature,
                submittedAt: confirmations[1].submissionDate.getTime(),
              },
            ],
            rejectors: expect.arrayContaining([
              expect.objectContaining({
                value: rejectionTxConfirmations[0].owner,
              }),
            ]),
            gasToken: tx.gasToken,
            gasTokenInfo: gasToken,
            trusted: tx.trusted,
          },
          txHash: tx.transactionHash,
          safeAppInfo: {
            name: safeAppsResponse[0].name,
            url: safeAppsResponse[0].url,
            logoUri: safeAppsResponse[0].iconUrl,
          },
        });
      });
  });

  it('Get a CANCELLED Multisig Transaction by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safeOwners = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const safe = safeBuilder()
      .with('owners', safeOwners)
      .with('nonce', 5)
      .build();
    const contract = contractBuilder().build();
    const executionDate = faker.date.recent();
    const safeTxGas = faker.number.int();
    const gasPrice = faker.string.hexadecimal();
    const baseGas = faker.number.int();
    const confirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const tx = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('operation', 0)
      .with('nonce', 4)
      .with('data', faker.string.hexadecimal({ length: 32 }))
      .with('isExecuted', false)
      .with('isSuccessful', null)
      .with('executionDate', executionDate)
      .with('safeTxGas', safeTxGas)
      .with('gasPrice', gasPrice)
      .with('baseGas', baseGas)
      .with('confirmations', confirmations)
      .build();
    const rejectionTxConfirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', rejectionTxConfirmations)
      .build();
    const rejectionTxsPage = pageBuilder()
      .with('results', [multisigToJson(rejectionTx)])
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const gasToken = tokenBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${tx.gasToken}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${tx.to}`;
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: chain, status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({ data: multisigToJson(tx), status: 200 });
        case getMultisigTransactionsUrl:
          return Promise.resolve({ data: rejectionTxsPage, status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: safe, status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: gasToken, status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: contract, status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({ data: safeAppsResponse, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${tx.safeTxHash}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${safe.address}_${tx.safeTxHash}`,
          executedAt: executionDate.getTime(),
          txStatus: 'CANCELLED',
          txInfo: {
            type: 'Custom',
            to: {
              value: contract.address,
              name: contract.displayName,
              logoUri: contract.logoUri,
            },
            dataSize: expect.any(String),
            value: expect.any(String),
            methodName: tx.dataDecoded?.method,
            actionCount: null,
            isCancellation: false,
          },
          txData: {
            hexData: tx.data,
            dataDecoded: tx.dataDecoded,
            to: {
              value: contract.address,
              name: contract.displayName,
              logoUri: contract.logoUri,
            },
            value: tx.value,
            operation: tx.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
          detailedExecutionInfo: {
            submittedAt: tx.submissionDate.getTime(),
            nonce: tx.nonce,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice,
            refundReceiver: expect.objectContaining({
              value: tx.refundReceiver,
            }),
            safeTxHash: tx.safeTxHash,
            executor: expect.objectContaining({ value: tx.executor }),
            signers: expect.arrayContaining([
              expect.objectContaining({ value: safeOwners[0] }),
              expect.objectContaining({ value: safeOwners[1] }),
            ]),
            confirmationsRequired: tx.confirmationsRequired,
            confirmations: expect.arrayContaining([
              expect.objectContaining({
                signer: expect.objectContaining({
                  value: confirmations[0].owner,
                }),
                signature: confirmations[0].signature,
                submittedAt: confirmations[0].submissionDate.getTime(),
              }),
              expect.objectContaining({
                signer: expect.objectContaining({
                  value: confirmations[1].owner,
                }),
                signature: confirmations[1].signature,
                submittedAt: confirmations[1].submissionDate.getTime(),
              }),
            ]),
            rejectors: expect.arrayContaining([
              expect.objectContaining({
                value: rejectionTxConfirmations[0].owner,
              }),
              expect.objectContaining({
                value: rejectionTxConfirmations[1].owner,
              }),
            ]),
            gasToken: tx.gasToken,
            gasTokenInfo: gasToken,
            trusted: tx.trusted,
          },
          txHash: tx.transactionHash,
          safeAppInfo: {
            name: safeAppsResponse[0].name,
            url: safeAppsResponse[0].url,
            logoUri: safeAppsResponse[0].iconUrl,
          },
        });
      });
  });
});
