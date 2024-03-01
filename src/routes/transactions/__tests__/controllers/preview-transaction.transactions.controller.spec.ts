import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { DomainModule } from '@/domain.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import {
  CALL_OPERATION,
  DELEGATE_OPERATION,
} from '@/domain/safe/entities/operation.entity';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ValidationModule } from '@/validation/validation.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TransactionsModule } from '@/routes/transactions/transactions.module';
import { previewTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/preview-transaction.dto.builder';

describe('Preview transaction - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

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
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder().build();
    await request(app.getHttpServer())
      .post(
        `/v1/chains/${faker.string.numeric()}/transactions/${faker.string.hexadecimal(
          { length: 16 },
        )}/preview`,
      )
      .send({ ...previewTransactionDto, value: 1 })
      .expect(400);
  });

  it('should preview a transaction', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', CALL_OPERATION)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder().build();
    const contractResponse = contractBuilder().build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
        },
      });
  });

  it('should preview a transaction with an unknown "to" address', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', CALL_OPERATION)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder().build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
        },
      });
  });

  it('should preview a transaction even if the data cannot be decoded', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', CALL_OPERATION)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.reject({ error: 'Data cannot be decoded' });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: null,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: null,
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
        },
      });
  });

  it('should preview a transaction with a nested call', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', DELEGATE_OPERATION)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder()
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('valueDecoded', [
            {
              operation: 0,
              data: faker.string.hexadecimal({ length: 32 }),
            },
          ])
          .build(),
      ])
      .build();
    const contractResponse = contractBuilder()
      .with('trustedForDelegateCall', true)
      .build();
    networkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: true,
          addressInfoIndex: null,
        },
      });
  });
});
