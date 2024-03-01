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
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenType } from '@/domain/tokens/entities/token.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
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

describe('List multisig transactions by Safe - Transactions Controller (Unit)', () => {
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
      new URL(
        `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
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
        `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
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
    expect(networkService.get).toHaveBeenCalledWith(
      `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/multisig-transactions/`,
      expect.objectContaining({
        params: expect.objectContaining({
          ordering: '-nonce',
          safe: safeAddress,
          trusted: true,
        }),
      }),
    );
  });

  it('Failure: data validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: chainResponse,
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: { results: ['invalidData'] },
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(500)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('Failure: data page validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    const page = pageBuilder().build();
    networkService.get.mockResolvedValueOnce({
      data: chainResponse,
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: { ...page, count: null },
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(500)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('Should get a ERC20 transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('value', '0')
      .with('operation', 0)
      .with('executionDate', new Date('2022-11-16T07:31:11Z'))
      .with('safeTxHash', '0x31d44c6')
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
              .with('value', '0x84662112A54cC30733A0DfF864bc38905AB42fD4')
              .build(),
            dataDecodedParameterBuilder()
              .with('name', 'value')
              .with('type', 'uint256')
              .with('value', '455753658736')
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
    const token = tokenBuilder()
      .with('type', TokenType.Erc20)
      .with('address', multisigTransaction.to)
      .build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${multisigTransaction.to}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [multisigTransactionToJson(multisigTransaction)])
            .build(),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found', status: 404 });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: token, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_0x31d44c6`,
                timestamp: multisigTransaction.executionDate?.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: {
                    value: '0x84662112A54cC30733A0DfF864bc38905AB42fD4',
                  },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: token.address,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                    decimals: token.decimals,
                    value: '455753658736',
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
          ],
        });
      });
  });

  it('Should get a ERC721 transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const token = tokenBuilder()
      .with('type', TokenType.Erc721)
      .with('address', '0x7Af3460d552f832fD7E2DE973c628ACeA59B0712')
      .build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', token.address)
      .with('value', '0')
      .with('operation', 0)
      .with('executionDate', new Date('2022-06-21T23:12:32.000Z'))
      .with('safeTxHash', '0x0f9f1b72')
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('origin', '{}')
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'safeTransferFrom')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('name', 'from')
              .with('type', 'address')
              .with('value', safe.address)
              .build(),
            dataDecodedParameterBuilder()
              .with('name', 'to')
              .with('type', 'address')
              .with('value', '0x3a55e304D9cF13E45Ead6BA3DabCcadD3a419356')
              .build(),
            dataDecodedParameterBuilder()
              .with('name', 'tokenId')
              .with('type', 'uint256')
              .with('value', '495')
              .build(),
          ])
          .build(),
      )
      .with('confirmationsRequired', 3)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/0x7Af3460d552f832fD7E2DE973c628ACeA59B0712`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [multisigTransactionToJson(multisigTransaction)])
            .build(),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found', status: 404 });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: token, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_0x0f9f1b72`,
                timestamp: 1655853152000,
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: {
                    value: '0x3a55e304D9cF13E45Ead6BA3DabCcadD3a419356',
                  },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC721',
                    tokenAddress: token.address,
                    tokenId: '495',
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                  },
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: multisigTransaction.nonce,
                  confirmationsRequired: 3,
                  confirmationsSubmitted: 3,
                  missingSigners: null,
                },
                safeAppInfo: null,
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a Custom transaction mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safeAppsResponse = [safeAppBuilder().build()];
    const contractResponse = contractBuilder().build();
    const domainTransaction = multisigTransactionBuilder()
      .with('value', '0')
      .with('data', faker.string.hexadecimal({ length: 32 }))
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'multiSend')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('name', 'transactions')
              .with('valueDecoded', [{}, {}, {}])
              .build(),
          ])
          .build(),
      )
      .build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${domainTransaction.safe}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${domainTransaction.safe}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: safeAppsResponse, status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: { results: [multisigTransactionToJson(domainTransaction)] },
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeBuilder().build(), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${domainTransaction.safe}/multisig-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${domainTransaction.safe}_${domainTransaction.safeTxHash}`,
                timestamp: domainTransaction.executionDate?.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Custom',
                  to: {
                    value: contractResponse.address,
                    name: contractResponse.displayName,
                    logoUri: contractResponse.logoUri,
                  },
                  dataSize: '16',
                  value: domainTransaction.value,
                  methodName: domainTransaction.dataDecoded?.method ?? null,
                  actionCount: 3,
                  isCancellation: false,
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: domainTransaction.nonce,
                  confirmationsRequired:
                    domainTransaction.confirmationsRequired,
                  confirmationsSubmitted:
                    domainTransaction.confirmations?.length,
                  missingSigners: null,
                },
                safeAppInfo: {
                  logoUri: safeAppsResponse[0].iconUrl,
                  name: safeAppsResponse[0].name,
                  url: safeAppsResponse[0].url,
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });
});
