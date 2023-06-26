import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import { ConfigurationModule } from '../../../../config/configuration.module';
import { IConfigurationService } from '../../../../config/configuration.service.interface';
import configuration from '../../../../config/entities/__tests__/configuration';
import { TestCacheModule } from '../../../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../../../domain.module';
import { chainBuilder } from '../../../../domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '../../../../domain/entities/__tests__/page.builder';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '../../../../domain/safe/entities/__tests__/erc20-transfer.builder';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '../../../../domain/safe/entities/__tests__/erc721-transfer.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '../../../../domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';
import { TokenType } from '../../../../domain/tokens/entities/token.entity';
import { TestLoggingModule } from '../../../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../../../validation/validation.module';
import { TransactionsModule } from '../../transactions.module';

describe('List incoming transfers by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        ConfigurationModule.register(configuration),
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    mockNetworkService.get.mockRejectedValueOnce({
      status: 500,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(mockNetworkService.get).toBeCalledTimes(1);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
  });

  it('Failure: Transaction API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    const limit = faker.number.int({ min: 0, max: 100 });
    const offset = faker.number.int({ min: 0, max: 100 });
    mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
    mockNetworkService.get.mockRejectedValueOnce({
      status: 500,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      )
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(mockNetworkService.get).toBeCalledTimes(2);
    expect(mockNetworkService.get).toBeCalledWith(
      `${safeConfigUrl}/api/v1/chains/${chainId}`,
      undefined,
    );
    expect(mockNetworkService.get).toBeCalledWith(
      `${chainResponse.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`,
      expect.objectContaining({
        params: expect.objectContaining({ offset, limit }),
      }),
    );
  });

  it('Failure: data validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
    mockNetworkService.get.mockResolvedValueOnce({
      data: { results: ['invalidData'] },
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
      .expect(500)
      .expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });
  });

  it('Should get a ERC20 incoming transfer mapped to the expected format', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder()
      .with('address', '0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C')
      .build();
    const erc20Transfer = erc20TransferBuilder()
      .with('executionDate', new Date('2022-11-07T09:03:48Z'))
      .with('to', safe.address)
      .with('from', safe.address)
      .with('transferId', 'e1015fc6905')
      .with('value', faker.number.int({ min: 1 }).toString())
      .with('tokenAddress', '0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60')
      .build();
    const token = tokenBuilder()
      .with('type', TokenType.Erc20)
      .with('address', erc20Transfer.tokenAddress)
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [erc20TransferToJson(erc20Transfer)])
            .build(),
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: token });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: 'transfer_0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C_e1015fc6905',
                executionInfo: null,
                safeAppInfo: null,
                timestamp: erc20Transfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: { value: safe.address },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: erc20Transfer.tokenAddress,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                    decimals: token.decimals,
                    value: erc20Transfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a ERC721 incoming transfer mapped to the expected format', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder()
      .with('address', '0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C')
      .build();
    const erc721Transfer = erc721TransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('tokenId', '110380171')
      .with('transferId', 'e1015fc6905')
      .build();
    const token = tokenBuilder()
      .with('type', TokenType.Erc721)
      .with('address', erc721Transfer.tokenAddress)
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${erc721Transfer.tokenAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [erc721TransferToJson(erc721Transfer)])
            .build(),
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: token });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: 'transfer_0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C_e1015fc6905',
                timestamp: erc721Transfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: erc721Transfer.from },
                  recipient: { value: erc721Transfer.to },
                  direction: 'INCOMING',
                  transferInfo: {
                    type: 'ERC721',
                    tokenAddress: token.address,
                    tokenId: erc721Transfer.tokenId,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a native coin incoming transfer mapped to the expected format', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder()
      .with('address', '0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C')
      .build();
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('value', faker.number.int({ min: 1 }).toString())
      .with('transferId', 'e1015fc690')
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chain });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: pageBuilder()
            .with('results', [nativeTokenTransferToJson(nativeTokenTransfer)])
            .build(),
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safe });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: 'transfer_0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C_e1015fc690',
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
});
