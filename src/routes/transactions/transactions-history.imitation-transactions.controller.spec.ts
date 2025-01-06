import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '@/domain/safe/entities/__tests__/ethereum-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenType } from '@/domain/tokens/entities/token.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import type {
  ERC20Transfer,
  Transfer,
} from '@/domain/safe/entities/transfer.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { getAddress, parseUnits, zeroAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { erc20TransferEncoder } from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import type { EthereumTransaction } from '@/domain/safe/entities/ethereum-transaction.entity';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { Server } from 'net';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Transactions History Controller (Unit) - Imitation Transactions', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  const lookupDistance = 2;
  const prefixLength = 3;
  const suffixLength = 4;
  const valueTolerance = BigInt(1);
  const echoLimit = BigInt(10);
  const chain = chainBuilder().build();
  const safe = safeBuilder().build();

  beforeEach(async () => {
    jest.resetAllMocks();

    const testConfiguration: typeof configuration = () => ({
      ...configuration(),
      mappings: {
        ...configuration().mappings,
        imitation: {
          lookupDistance,
          valueTolerance,
          prefixLength,
          suffixLength,
          echoLimit,
        },
      },
      features: {
        ...configuration().features,
        improvedAddressPoisoning: true,
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

  function getImitationAddress(address: `0x${string}`): `0x${string}` {
    // + 2 is to account for the '0x' prefix
    const prefix = address.slice(0, prefixLength + 2);
    const suffix = address.slice(-suffixLength);
    const imitator = `${prefix}${faker.finance.ethereumAddress().slice(prefixLength + 2, -suffixLength)}${suffix}`;
    return getAddress(imitator);
  }

  describe('Event spoofing', () => {
    function parseUnits(value: bigint, decimals: number): bigint {
      return value * BigInt(10 ** decimals);
    }

    const multisigExecutionDate = new Date('2024-03-20T09:41:25Z');
    const multisigToken = tokenBuilder().with('type', TokenType.Erc20).build();
    // Use value higher than BigInt(2) as we use tolerance +/- BigInt(1) to signify outside tolerance
    // later in tests, and values of 0 are not mapped
    const testValueBuffer = valueTolerance + faker.number.bigInt({ min: 2 });
    const multisigTransferValue = parseUnits(
      faker.number.bigInt({
        min: testValueBuffer,
        max: testValueBuffer + valueTolerance,
      }),
      multisigToken.decimals!,
    );
    const multisigTransfer = {
      ...erc20TransferBuilder()
        .with('executionDate', multisigExecutionDate)
        .with('from', safe.address)
        .with('tokenAddress', multisigToken.address)
        .with('value', multisigTransferValue.toString())
        .build(),
      tokenInfo: multisigToken,
    };
    const multisigTransaction = {
      ...(multisigTransactionToJson(
        multisigTransactionBuilder()
          .with('executionDate', multisigExecutionDate)
          .with('safe', safe.address)
          .with('to', multisigToken.address)
          .with('value', '0')
          .with('operation', 0)
          .with('gasToken', zeroAddress)
          .with('safeTxGas', 0)
          .with('baseGas', 0)
          .with('gasPrice', '0')
          .with('refundReceiver', zeroAddress)
          .with('proposer', safe.owners[0])
          .with('executor', safe.owners[0])
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
                  .with('value', multisigTransfer.to)
                  .build(),
                dataDecodedParameterBuilder()
                  .with('name', 'value')
                  .with('type', 'uint256')
                  .with('value', multisigTransfer.value)
                  .build(),
              ])
              .build(),
          )
          .with('confirmationsRequired', 1)
          .with('confirmations', [
            confirmationBuilder().with('owner', safe.owners[0]).build(),
          ])
          .with('trusted', true)
          .build(),
      ) as MultisigTransaction),
      // TODO: Update type to include transfers
      transfers: [erc20TransferToJson(multisigTransfer) as Transfer],
    } as MultisigTransaction;

    const notImitatedMultisigToken = tokenBuilder()
      .with('type', TokenType.Erc20)
      .build();
    const notImitatedMultisigTransfer = {
      ...erc20TransferBuilder()
        .with('executionDate', multisigExecutionDate)
        .with('from', safe.address)
        .with('tokenAddress', notImitatedMultisigToken.address)
        .with('value', multisigTransfer.value)
        .build(),
      tokenInfo: multisigToken,
    };
    const notImitatedMultisigTransaction = {
      ...(multisigTransactionToJson(
        multisigTransactionBuilder()
          .with('executionDate', multisigExecutionDate)
          .with('safe', safe.address)
          .with('to', notImitatedMultisigToken.address)
          .with('value', '0')
          .with('operation', 0)
          .with('gasToken', zeroAddress)
          .with('safeTxGas', 0)
          .with('baseGas', 0)
          .with('gasPrice', '0')
          .with('refundReceiver', zeroAddress)
          .with('proposer', safe.owners[0])
          .with('executor', safe.owners[0])
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
                  .with('value', notImitatedMultisigTransfer.to)
                  .build(),
                dataDecodedParameterBuilder()
                  .with('name', 'value')
                  .with('type', 'uint256')
                  .with('value', notImitatedMultisigTransfer.value)
                  .build(),
              ])
              .build(),
          )
          .with('confirmationsRequired', 1)
          .with('confirmations', [
            confirmationBuilder().with('owner', safe.owners[0]).build(),
          ])
          .with('trusted', true)
          .build(),
      ) as MultisigTransaction),
      // TODO: Update type to include transfers
      transfers: [erc20TransferToJson(notImitatedMultisigTransfer) as Transfer],
    } as MultisigTransaction;

    const imitationAddress = getImitationAddress(multisigTransfer.to);
    const imitationExecutionDate = new Date('2024-03-20T09:42:58Z');
    const imitationToken = tokenBuilder()
      .with('type', TokenType.Erc20)
      .with('decimals', multisigToken.decimals)
      .build();

    const imitationIncomingTransfer = {
      ...erc20TransferBuilder()
        .with('from', imitationAddress)
        .with('to', safe.address)
        .with('tokenAddress', imitationToken.address)
        .with('value', multisigTransfer.value)
        .with('executionDate', imitationExecutionDate)
        .build(),
      // TODO: Update type to include tokenInfo
      tokenInfo: imitationToken,
    };
    const imitationIncomingErc20Transfer = erc20TransferEncoder()
      .with('to', safe.address)
      .with('value', BigInt(multisigTransfer.value));
    const imitationIncomingTransaction = ethereumTransactionToJson(
      ethereumTransactionBuilder()
        .with('executionDate', imitationIncomingTransfer.executionDate)
        .with('data', imitationIncomingErc20Transfer.encode())
        .with('transfers', [
          erc20TransferToJson(imitationIncomingTransfer) as Transfer,
        ])
        .build(),
    ) as EthereumTransaction;

    const imitationOutgoingTransfer = {
      ...erc20TransferBuilder()
        .with('from', safe.address)
        .with('to', imitationAddress)
        .with('tokenAddress', imitationToken.address)
        .with('value', multisigTransfer.value)
        .with('executionDate', imitationExecutionDate)
        .build(),
      // TODO: Update type to include tokenInfo
      tokenInfo: imitationToken,
    };
    const imitationOutgoingErc20Transfer = erc20TransferEncoder()
      .with('to', imitationAddress)
      .with('value', BigInt(multisigTransfer.value));
    const imitationOutgoingTransaction = ethereumTransactionToJson(
      ethereumTransactionBuilder()
        .with('executionDate', imitationOutgoingTransfer.executionDate)
        .with('data', imitationOutgoingErc20Transfer.encode())
        .with('transfers', [
          erc20TransferToJson(imitationOutgoingTransfer) as Transfer,
        ])
        .build(),
    ) as EthereumTransaction;

    const getAllTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${multisigToken.address}`;
    const getNotImitatedTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${notImitatedMultisigToken.address}`;
    const getImitationTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${imitationToken.address}`;

    describe('Tolerant value', () => {
      it('should flag imitation incoming/outgoing transfers with a tolerant value within the lookup distance', async () => {
        const results = [
          imitationIncomingTransaction,
          multisigTransaction,
          imitationOutgoingTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: true,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[2].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: true,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationOutgoingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not flag imitation incoming/outgoing transfers with a tolerant outside the lookup distance', async () => {
        const results = [
          imitationIncomingTransaction,
          imitationOutgoingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];

        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false, // Not flagged
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[1].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false, // Not flagged
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationOutgoingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should filter out imitation incoming/outgoing transfers with a tolerant within the lookup distance', async () => {
        const results = [
          imitationIncomingTransaction,
          multisigTransaction,
          imitationOutgoingTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];

        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927685000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txHash: notImitatedMultisigTransaction.transactionHash,
                  txStatus: 'SUCCESS',
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not filter out imitation incoming/outgoing transfers with a tolerant within outside the lookup distance', async () => {
        const results = [
          imitationIncomingTransaction,
          imitationOutgoingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];

        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false, // Not flagged
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[1].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false, // Not flagged
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationOutgoingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });
    });

    describe('Intolerant value', () => {
      const intolerantDiff = parseUnits(
        valueTolerance * BigInt(2),
        multisigToken.decimals!,
      );
      const valueIntolerantIncomingTransaction = ((): EthereumTransaction => {
        const transaction = structuredClone(imitationIncomingTransaction);
        (transaction.transfers![0] as ERC20Transfer).value = faker.helpers
          .arrayElement([
            multisigTransferValue + intolerantDiff,
            multisigTransferValue - intolerantDiff,
          ])
          .toString();
        return transaction;
      })();
      const valueIntolerantOutgoingTransaction = ((): EthereumTransaction => {
        const transaction = structuredClone(imitationOutgoingTransaction);
        (transaction.transfers![0] as ERC20Transfer).value = faker.helpers
          .arrayElement([
            multisigTransferValue + intolerantDiff,
            multisigTransferValue - intolerantDiff,
          ])
          .toString();
        return transaction;
      })();

      it('should not flag incoming/outgoing transfers of vanity with an intolerant value within the lookup distance', async () => {
        const results = [
          valueIntolerantIncomingTransaction,
          multisigTransaction,
          valueIntolerantOutgoingTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantIncomingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantIncomingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[2].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: new Date(
                    valueIntolerantOutgoingTransaction.executionDate,
                  ).getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantOutgoingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantOutgoingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not flag imitation incoming/outgoing transfers of vanity with an intolerant value outside the lookup distance', async () => {
        const results = [
          valueIntolerantIncomingTransaction,
          valueIntolerantOutgoingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantIncomingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantIncomingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[1].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: new Date(
                    valueIntolerantOutgoingTransaction.executionDate,
                  ).getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantOutgoingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantOutgoingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not filter out imitation incoming/outgoing transfers of vanity with an intolerant value within the lookup distance', async () => {
        const results = [
          valueIntolerantIncomingTransaction,
          multisigTransaction,
          valueIntolerantOutgoingTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantIncomingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantIncomingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[2].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: new Date(
                    valueIntolerantOutgoingTransaction.executionDate,
                  ).getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantOutgoingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantOutgoingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not filter out imitation incoming/outgoing transfers of vanity with an intolerant value outside the lookup distance', async () => {
        const results = [
          valueIntolerantIncomingTransaction,
          valueIntolerantOutgoingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          if (url === getImitationTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(imitationToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantIncomingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantIncomingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[1].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: new Date(
                    valueIntolerantOutgoingTransaction.executionDate,
                  ).getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: imitationAddress,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: imitationToken.decimals,
                      imitation: false,
                      logoUri: imitationToken.logoUri,
                      tokenAddress: imitationToken.address,
                      tokenName: imitationToken.name,
                      tokenSymbol: imitationToken.symbol,
                      trusted: imitationToken.trusted,
                      type: 'ERC20',
                      value: (
                        valueIntolerantOutgoingTransaction
                          .transfers![0] as ERC20Transfer
                      ).value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    valueIntolerantOutgoingTransaction.transfers![0]
                      .transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927685000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });
    });

    it('should detect imitation tokens using differing decimals', async () => {
      const differentDecimals = multisigToken.decimals! + 1;
      const differentValue = multisigTransfer.value + '0';
      const imitationWithDifferentDecimalsAddress = getImitationAddress(
        multisigTransfer.to,
      );
      const imitationWithDifferentDecimalsExecutionDate = new Date(
        '2024-03-20T09:42:58Z',
      );
      const imitationWithDifferentDecimalsToken = tokenBuilder()
        .with('type', TokenType.Erc20)
        .with('decimals', differentDecimals)
        .build();

      const imitationWithDifferentDecimalsIncomingTransfer = {
        ...erc20TransferBuilder()
          .with('from', imitationWithDifferentDecimalsAddress)
          .with('to', safe.address)
          .with('tokenAddress', imitationWithDifferentDecimalsToken.address)
          .with('value', differentValue)
          .with('executionDate', imitationWithDifferentDecimalsExecutionDate)
          .build(),
        // TODO: Update type to include tokenInfo
        tokenInfo: imitationWithDifferentDecimalsToken,
      };
      const imitationWithDifferentDecimalsIncomingErc20Transfer =
        erc20TransferEncoder()
          .with('to', safe.address)
          .with('value', BigInt(differentValue));
      const imitationWithDifferentDecimalsIncomingTransaction =
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with(
              'executionDate',
              imitationWithDifferentDecimalsIncomingTransfer.executionDate,
            )
            .with(
              'data',
              imitationWithDifferentDecimalsIncomingErc20Transfer.encode(),
            )
            .with('transfers', [
              erc20TransferToJson(
                imitationWithDifferentDecimalsIncomingTransfer,
              ) as Transfer,
            ])
            .build(),
        ) as EthereumTransaction;

      const results = [
        imitationWithDifferentDecimalsIncomingTransaction,
        multisigTransaction,
      ];
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === getAllTransactionsUrl) {
          return Promise.resolve({
            data: rawify(pageBuilder().with('results', results).build()),
            status: 200,
          });
        }
        if (url === getSafeUrl) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (url === getTokenAddressUrl) {
          return Promise.resolve({
            data: rawify(multisigToken),
            status: 200,
          });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${imitationWithDifferentDecimalsToken.address}`
        ) {
          return Promise.resolve({
            data: rawify(imitationWithDifferentDecimalsToken),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
        )
        .expect(200)
        .then(({ body }) => {
          expect(body.results).toStrictEqual([
            {
              timestamp: 1710927778000,
              type: 'DATE_LABEL',
            },
            {
              conflictType: 'None',
              transaction: {
                executionInfo: null,
                // @ts-expect-error - Type does not contain transfers
                id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                safeAppInfo: null,
                timestamp: 1710927778000,
                txInfo: {
                  direction: 'INCOMING',
                  humanDescription: null,
                  recipient: {
                    logoUri: null,
                    name: null,
                    value: safe.address,
                  },
                  sender: {
                    logoUri: null,
                    name: null,
                    value: imitationWithDifferentDecimalsAddress,
                  },
                  transferInfo: {
                    decimals: imitationWithDifferentDecimalsToken.decimals,
                    imitation: true,
                    logoUri: imitationWithDifferentDecimalsToken.logoUri,
                    tokenAddress: imitationWithDifferentDecimalsToken.address,
                    tokenName: imitationWithDifferentDecimalsToken.name,
                    tokenSymbol: imitationWithDifferentDecimalsToken.symbol,
                    trusted: imitationWithDifferentDecimalsToken.trusted,
                    type: 'ERC20',
                    value: imitationWithDifferentDecimalsIncomingTransfer.value,
                  },
                  type: 'Transfer',
                },
                txStatus: 'SUCCESS',
                txHash:
                  imitationWithDifferentDecimalsIncomingTransaction
                    .transfers![0].transactionHash,
              },
              type: 'TRANSACTION',
            },
            {
              conflictType: 'None',
              transaction: {
                executionInfo: {
                  confirmationsRequired: 1,
                  confirmationsSubmitted: 1,
                  missingSigners: null,
                  nonce: multisigTransaction.nonce,
                  type: 'MULTISIG',
                },
                id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                safeAppInfo: null,
                timestamp: 1710927685000,
                txInfo: {
                  direction: 'OUTGOING',
                  humanDescription: null,
                  recipient: {
                    logoUri: null,
                    name: null,
                    value: multisigTransfer.to,
                  },
                  sender: {
                    logoUri: null,
                    name: null,
                    value: safe.address,
                  },
                  transferInfo: {
                    decimals: multisigToken.decimals,
                    imitation: false,
                    logoUri: multisigToken.logoUri,
                    tokenAddress: multisigToken.address,
                    tokenName: multisigToken.name,
                    tokenSymbol: multisigToken.symbol,
                    trusted: null,
                    type: 'ERC20',
                    value: multisigTransfer.value,
                  },
                  type: 'Transfer',
                },
                txStatus: 'SUCCESS',
                txHash: multisigTransaction.transactionHash,
              },
              type: 'TRANSACTION',
            },
          ]);
        });
    });
  });

  describe('Echo transfers', () => {
    const multisigExecutionDate = new Date('2024-03-20T09:42:58Z');
    const multisigToken = tokenBuilder().with('type', TokenType.Erc20).build();
    const multisigTransfer = {
      ...erc20TransferBuilder()
        .with('executionDate', multisigExecutionDate)
        .with('from', safe.address)
        .with('tokenAddress', multisigToken.address)
        .with(
          'value',
          parseUnits(
            // Value vastly above echo limit for testing flagging
            (echoLimit * faker.number.bigInt({ min: 3, max: 9 })).toString(),
            multisigToken.decimals!,
          ).toString(),
        )
        .build(),
      tokenInfo: multisigToken,
    };
    const multisigTransaction = {
      ...(multisigTransactionToJson(
        multisigTransactionBuilder()
          .with('executionDate', multisigExecutionDate)
          .with('safe', safe.address)
          .with('to', multisigToken.address)
          .with('value', '0')
          .with('operation', 0)
          .with('gasToken', zeroAddress)
          .with('safeTxGas', 0)
          .with('baseGas', 0)
          .with('gasPrice', '0')
          .with('refundReceiver', zeroAddress)
          .with('proposer', safe.owners[0])
          .with('executor', safe.owners[0])
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
                  .with('value', multisigTransfer.to)
                  .build(),
                dataDecodedParameterBuilder()
                  .with('name', 'value')
                  .with('type', 'uint256')
                  .with('value', multisigTransfer.value)
                  .build(),
              ])
              .build(),
          )
          .with('confirmationsRequired', 1)
          .with('confirmations', [
            confirmationBuilder().with('owner', safe.owners[0]).build(),
          ])
          .with('trusted', true)
          .build(),
      ) as MultisigTransaction),
      // TODO: Update type to include transfers
      transfers: [erc20TransferToJson(multisigTransfer) as Transfer],
    } as MultisigTransaction;

    const notImitatedMultisigToken = tokenBuilder()
      .with('type', TokenType.Erc20)
      .with('decimals', multisigToken.decimals)
      .build();
    const notImitatedMultisigTransfer = {
      ...erc20TransferBuilder()
        .with('executionDate', multisigExecutionDate)
        .with('from', safe.address)
        .with('tokenAddress', notImitatedMultisigToken.address)
        .with('value', faker.string.numeric({ exclude: ['0'] }))
        .build(),
      tokenInfo: multisigToken,
    };
    const notImitatedMultisigTransaction = {
      ...(multisigTransactionToJson(
        multisigTransactionBuilder()
          .with('executionDate', multisigExecutionDate)
          .with('safe', safe.address)
          .with('to', notImitatedMultisigToken.address)
          .with('value', '0')
          .with('operation', 0)
          .with('gasToken', zeroAddress)
          .with('safeTxGas', 0)
          .with('baseGas', 0)
          .with('gasPrice', '0')
          .with('refundReceiver', zeroAddress)
          .with('proposer', safe.owners[0])
          .with('executor', safe.owners[0])
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
                  .with('value', notImitatedMultisigTransfer.to)
                  .build(),
                dataDecodedParameterBuilder()
                  .with('name', 'value')
                  .with('type', 'uint256')
                  .with('value', notImitatedMultisigTransfer.value)
                  .build(),
              ])
              .build(),
          )
          .with('confirmationsRequired', 1)
          .with('confirmations', [
            confirmationBuilder().with('owner', safe.owners[0]).build(),
          ])
          .with('trusted', true)
          .build(),
      ) as MultisigTransaction),
      // TODO: Update type to include transfers
      transfers: [erc20TransferToJson(notImitatedMultisigTransfer) as Transfer],
    } as MultisigTransaction;
    const imitationAddress = getImitationAddress(multisigTransfer.to);

    const getAllTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/all-transactions/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${multisigToken.address}`;
    const getNotImitatedTokenAddressUrl = `${chain.transactionService}/api/v1/tokens/${notImitatedMultisigToken.address}`;

    describe('Below limit', () => {
      const imitationExecutionDate = new Date('2024-03-20T09:42:58Z');
      const imitationIncomingTransfer = {
        ...erc20TransferBuilder()
          .with('to', safe.address)
          .with('from', imitationAddress)
          .with('tokenAddress', multisigToken.address)
          .with(
            'value',
            parseUnits(
              faker.number.bigInt({ min: 1, max: echoLimit }).toString(),
              multisigToken.decimals!,
            ).toString(),
          )
          .with('executionDate', imitationExecutionDate)
          .build(),
        // TODO: Update type to include tokenInfo
        tokenInfo: multisigToken,
      };
      const imitationIncomingErc20Transfer = erc20TransferEncoder()
        .with('to', safe.address)
        .with('value', BigInt(imitationIncomingTransfer.value));
      const imitationIncomingTransaction = ethereumTransactionToJson(
        ethereumTransactionBuilder()
          .with('executionDate', imitationIncomingTransfer.executionDate)
          .with('data', imitationIncomingErc20Transfer.encode())
          .with('transfers', [
            erc20TransferToJson(imitationIncomingTransfer) as Transfer,
          ])
          .build(),
      ) as EthereumTransaction;

      it('should flag imitation incoming transfers of vanity with a below-limit value within the lookup distance', async () => {
        const results = [imitationIncomingTransaction, multisigTransaction];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationIncomingTransaction.transfers![0].from,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: true,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: multisigToken.trusted,
                      type: 'ERC20',
                      value: imitationIncomingTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not flag imitation incoming transfers of vanity with a below-limit value outside the lookup distance', async () => {
        const results = [
          imitationIncomingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];

        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationIncomingTransaction.transfers![0].from,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: multisigToken.trusted,
                      type: 'ERC20',
                      value: imitationIncomingTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should filter out imitation incoming transfers of vanity with a below-limit value within the lookup distance', async () => {
        const results = [imitationIncomingTransaction, multisigTransaction];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it('should not filter out imitation incoming transfers of vanity with a below-limit value outside the lookup distance', async () => {
        const results = [
          imitationIncomingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];

        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=false`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: imitationIncomingTransaction.transfers![0].from,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: multisigToken.trusted,
                      type: 'ERC20',
                      value: imitationIncomingTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    imitationIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });
    });

    describe('Above limit', () => {
      const aboveLimitExecutionDate = new Date('2024-03-20T09:42:58Z');
      const aboveLimitIncomingTransfer = {
        ...erc20TransferBuilder()
          .with('to', safe.address)
          .with('from', imitationAddress)
          .with('tokenAddress', multisigToken.address)
          .with(
            'value',
            parseUnits(
              faker.number.bigInt({ min: echoLimit }).toString(),
              multisigToken.decimals!,
            ).toString(),
          )
          .with('executionDate', aboveLimitExecutionDate)
          .build(),
        // TODO: Update type to include tokenInfo
        tokenInfo: multisigToken,
      };
      const aboveLimitErc20Transfer = erc20TransferEncoder()
        .with('to', safe.address)
        .with('value', BigInt(aboveLimitIncomingTransfer.value));
      const aboveLimitIncomingTransaction = ethereumTransactionToJson(
        ethereumTransactionBuilder()
          .with('executionDate', aboveLimitIncomingTransfer.executionDate)
          .with('data', aboveLimitErc20Transfer.encode())
          .with('transfers', [
            erc20TransferToJson(aboveLimitIncomingTransfer) as Transfer,
          ])
          .build(),
      ) as EthereumTransaction;

      it.each([
        [
          'should not flag imitation incoming transfers of vanity with an above-limit value within the lookup distance',
          true,
        ],
        [
          'should not filter out imitation incoming of vanity transfers with an above-limit value within the lookup distance',
          false,
        ],
      ])(`%s`, async (_, filter) => {
        const results = [aboveLimitIncomingTransaction, multisigTransaction];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=${filter}`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: aboveLimitIncomingTransaction.transfers![0].from,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: multisigToken.trusted,
                      type: 'ERC20',
                      value: aboveLimitIncomingTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    aboveLimitIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });

      it.each([
        [
          'should not flag imitation incoming transfers of vanity with an above-limit value outside the lookup distance',
          true,
        ],
        [
          'should not filter out imitation incoming of vanity transfers with an above-limit value outside the lookup distance',
          false,
        ],
      ])(`%s`, async (_, filter) => {
        const results = [
          aboveLimitIncomingTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          notImitatedMultisigTransaction,
          multisigTransaction,
        ];
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: rawify(chain), status: 200 });
          }
          if (url === getAllTransactionsUrl) {
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', results).build()),
              status: 200,
            });
          }
          if (url === getSafeUrl) {
            return Promise.resolve({ data: rawify(safe), status: 200 });
          }
          if (url === getTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(multisigToken),
              status: 200,
            });
          }
          if (url === getNotImitatedTokenAddressUrl) {
            return Promise.resolve({
              data: rawify(notImitatedMultisigToken),
              status: 200,
            });
          }
          return Promise.reject(new Error(`Could not match ${url}`));
        });

        await request(app.getHttpServer())
          .get(
            `/v1/chains/${chain.chainId}/safes/${safe.address}/transactions/history?trusted=false&imitation=${filter}`,
          )
          .expect(200)
          .then(({ body }) => {
            expect(body.results).toStrictEqual([
              {
                timestamp: 1710927778000,
                type: 'DATE_LABEL',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: null,
                  // @ts-expect-error - Type does not contain transfers
                  id: `transfer_${safe.address}_${results[0].transfers[0].transferId}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'INCOMING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: aboveLimitIncomingTransaction.transfers![0].from,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: multisigToken.trusted,
                      type: 'ERC20',
                      value: aboveLimitIncomingTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash:
                    aboveLimitIncomingTransaction.transfers![0].transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: notImitatedMultisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${notImitatedMultisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp:
                    notImitatedMultisigTransfer.executionDate.getTime(),
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: notImitatedMultisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: notImitatedMultisigToken.decimals,
                      imitation: false,
                      logoUri: notImitatedMultisigToken.logoUri,
                      tokenAddress: notImitatedMultisigToken.address,
                      tokenName: notImitatedMultisigToken.name,
                      tokenSymbol: notImitatedMultisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: notImitatedMultisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: notImitatedMultisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
              {
                conflictType: 'None',
                transaction: {
                  executionInfo: {
                    confirmationsRequired: 1,
                    confirmationsSubmitted: 1,
                    missingSigners: null,
                    nonce: multisigTransaction.nonce,
                    type: 'MULTISIG',
                  },
                  id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                  safeAppInfo: null,
                  timestamp: 1710927778000,
                  txInfo: {
                    direction: 'OUTGOING',
                    humanDescription: null,
                    recipient: {
                      logoUri: null,
                      name: null,
                      value: multisigTransfer.to,
                    },
                    sender: {
                      logoUri: null,
                      name: null,
                      value: safe.address,
                    },
                    transferInfo: {
                      decimals: multisigToken.decimals,
                      imitation: false,
                      logoUri: multisigToken.logoUri,
                      tokenAddress: multisigToken.address,
                      tokenName: multisigToken.name,
                      tokenSymbol: multisigToken.symbol,
                      trusted: null,
                      type: 'ERC20',
                      value: multisigTransfer.value,
                    },
                    type: 'Transfer',
                  },
                  txStatus: 'SUCCESS',
                  txHash: multisigTransaction.transactionHash,
                },
                type: 'TRANSACTION',
              },
            ]);
          });
      });
    });
  });
});
