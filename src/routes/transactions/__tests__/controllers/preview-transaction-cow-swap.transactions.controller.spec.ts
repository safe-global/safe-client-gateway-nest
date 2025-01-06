import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { AppModule } from '@/app.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { previewTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/preview-transaction.dto.builder';
import { CacheModule } from '@/datasources/cache/cache.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { setPreSignatureEncoder } from '@/domain/swaps/contracts/__tests__/encoders/gp-v2-encoder.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Preview transaction - CoW Swap - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let swapsChainId: string;
  let swapsApiUrl: string;
  let swapsExplorerUrl: string;
  const swapsVerifiedApp = faker.company.buzzNoun();

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfig = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfig,
      swaps: {
        ...baseConfig.swaps,
        restrictApps: true,
        allowedApps: [swapsVerifiedApp],
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
    const swapApiConfig =
      configurationService.getOrThrow<Record<string, string>>('swaps.api');
    swapsChainId = faker.helpers.objectKey(swapApiConfig);
    swapsApiUrl = swapApiConfig[swapsChainId];
    swapsExplorerUrl = configurationService.getOrThrow(`swaps.explorerBaseUri`);
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Swaps', () => {
    it('should preview a transaction', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', preSignatureEncoder.encode())
        .with('operation', Operation.CALL)
        .build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: rawify(order), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect({
          txInfo: {
            type: 'SwapOrder',
            humanDescription: null,
            uid: order.uid,
            status: order.status,
            kind: order.kind,
            orderClass: order.class,
            validUntil: order.validTo,
            sellAmount: order.sellAmount.toString(),
            buyAmount: order.buyAmount.toString(),
            executedSellAmount: order.executedSellAmount.toString(),
            executedBuyAmount: order.executedBuyAmount.toString(),
            explorerUrl: `${swapsExplorerUrl}orders/${order.uid}`,
            executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
            sellToken: {
              address: sellToken.address,
              decimals: sellToken.decimals,
              logoUri: sellToken.logoUri,
              name: sellToken.name,
              symbol: sellToken.symbol,
              trusted: sellToken.trusted,
            },
            buyToken: {
              address: buyToken.address,
              decimals: buyToken.decimals,
              logoUri: buyToken.logoUri,
              name: buyToken.name,
              symbol: buyToken.symbol,
              trusted: buyToken.trusted,
            },
            receiver: order.receiver,
            owner: order.owner,
            fullAppData: JSON.parse(order.fullAppData as string),
          },
          txData: {
            hexData: previewTransactionDto.data,
            dataDecoded,
            to: {
              value: previewTransactionDto.to,
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

    it('should preview a batched transaction', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      const swapTransaction = {
        operation: Operation.CALL,
        data: preSignatureEncoder.encode(),
        to: getAddress(faker.finance.ethereumAddress()),
        value: BigInt(0),
      };
      const multiSendTransaction = multiSendEncoder().with(
        'transactions',
        multiSendTransactionsEncoder([swapTransaction]),
      );
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', multiSendTransaction.encode())
        .with('operation', Operation.CALL)
        .build();
      const dataDecoded = dataDecodedBuilder().build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      const tokenResponse = tokenBuilder()
        .with('address', swapTransaction.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: rawify(order), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${swapTransaction.to}`
        ) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect({
          txInfo: {
            type: 'SwapOrder',
            humanDescription: null,
            uid: order.uid,
            status: order.status,
            kind: order.kind,
            orderClass: order.class,
            validUntil: order.validTo,
            sellAmount: order.sellAmount.toString(),
            buyAmount: order.buyAmount.toString(),
            executedSellAmount: order.executedSellAmount.toString(),
            executedBuyAmount: order.executedBuyAmount.toString(),
            explorerUrl: `${swapsExplorerUrl}orders/${order.uid}`,
            executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
            sellToken: {
              address: sellToken.address,
              decimals: sellToken.decimals,
              logoUri: sellToken.logoUri,
              name: sellToken.name,
              symbol: sellToken.symbol,
              trusted: sellToken.trusted,
            },
            buyToken: {
              address: buyToken.address,
              decimals: buyToken.decimals,
              logoUri: buyToken.logoUri,
              name: buyToken.name,
              symbol: buyToken.symbol,
              trusted: buyToken.trusted,
            },
            receiver: order.receiver,
            owner: order.owner,
            fullAppData: JSON.parse(order.fullAppData as string),
          },
          txData: {
            hexData: previewTransactionDto.data,
            dataDecoded,
            to: {
              value: previewTransactionDto.to,
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

    it('should return executedSurplusFee as null if not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('executedSurplusFee', null)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', preSignatureEncoder.encode())
        .with('operation', Operation.CALL)
        .build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: rawify(order), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) =>
          expect(body.txInfo).toMatchObject({
            type: 'SwapOrder',
            executedSurplusFee: null,
          }),
        );
    });

    it('should return a "standard" transaction preview if order data is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', preSignatureEncoder.encode())
        .with('operation', Operation.CALL)
        .build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.reject({ status: 500 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });

    it('should return a "standard" transaction preview if buy token is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', preSignatureEncoder.encode())
        .with('operation', Operation.CALL)
        .build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: rawify(order), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.reject({ status: 500 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });

    it('should return a "standard" transaction preview if sell token is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.sellToken).build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', preSignatureEncoder.encode())
        .with('operation', Operation.CALL)
        .build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: rawify(order), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.reject({ status: 500 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });

    it('should return a "standard" transaction preview if the swap app is restricted', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        // We don't use buzzNoun here as it can generate the same value as swapsVerifiedApp
        .with('fullAppData', `{ "appCode": "restricted app code" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', preSignatureEncoder.encode())
        .with('operation', Operation.CALL)
        .build();
      const contractResponse = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: rawify(order), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
        ) {
          return Promise.resolve({
            data: rawify(contractResponse),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });
  });

  describe('TWAPs', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    const ComposableCowAddress = '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74';

    /**
     * @see https://sepolia.etherscan.io/address/0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74
     */
    const safe = safeBuilder()
      .with('address', '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381')
      .build();
    const data =
      '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011f294a00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b1400000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000b941d039eed310b36000000000000000000000000000000000000000000000000087bbc924df9167e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000007080000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000';
    const appDataHash =
      '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0';
    const appData = { appCode: swapsVerifiedApp };
    const fullAppData = {
      fullAppData: JSON.stringify(appData),
    };
    const buyToken = tokenBuilder()
      .with('address', getAddress('0xfff9976782d46cc05630d1f6ebab18b2324d6b14'))
      .build();
    const sellToken = tokenBuilder()
      .with('address', getAddress('0xbe72e441bf55620febc26715db68d3494213d8cb'))
      .build();

    it('should preview a transaction', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const dataDecoded = dataDecodedBuilder().build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('to', ComposableCowAddress)
        .with('data', data)
        .with('operation', Operation.CALL)
        .build();
      const contract = contractBuilder()
        .with('address', ComposableCowAddress)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${buyToken.address}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${sellToken.address}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/app_data/${appDataHash}`) {
          return Promise.resolve({ data: rawify(fullAppData), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contract.address}`
        ) {
          return Promise.resolve({ data: rawify(contract), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect({
          txInfo: {
            type: 'TwapOrder',
            humanDescription: null,
            status: 'presignaturePending',
            kind: 'sell',
            class: 'limit',
            activeOrderUid: null,
            validUntil: Math.ceil(now.getTime() / 1_000) + 3599,
            sellAmount: '427173750967724283500',
            buyAmount: '1222579021996502268',
            executedSellAmount: '0',
            executedBuyAmount: '0',
            executedSurplusFee: '0',
            sellToken: {
              address: sellToken.address,
              decimals: sellToken.decimals,
              logoUri: sellToken.logoUri,
              name: sellToken.name,
              symbol: sellToken.symbol,
              trusted: sellToken.trusted,
            },
            buyToken: {
              address: buyToken.address,
              decimals: buyToken.decimals,
              logoUri: buyToken.logoUri,
              name: buyToken.name,
              symbol: buyToken.symbol,
              trusted: buyToken.trusted,
            },
            receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
            owner: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
            fullAppData: appData,
            numberOfParts: '2',
            partSellAmount: '213586875483862141750',
            minPartLimit: '611289510998251134',
            timeBetweenParts: 1800,
            durationOfPart: { durationType: 'AUTO' },
            startTime: { startType: 'AT_MINING_TIME' },
          },
          txData: {
            hexData: previewTransactionDto.data,
            dataDecoded,
            to: {
              value: ComposableCowAddress,
              name: contract.displayName,
              logoUri: contract.logoUri,
            },
            value: previewTransactionDto.value,
            operation: previewTransactionDto.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
        });
    });

    it('should preview a batched transaction', async () => {
      const now = new Date();
      jest.setSystemTime(now);

      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const twapTransaction = {
        operation: Operation.CALL,
        data,
        to: ComposableCowAddress,
        value: BigInt(0),
      } as const;
      const multiSendTransaction = multiSendEncoder().with(
        'transactions',
        multiSendTransactionsEncoder([twapTransaction]),
      );
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('data', multiSendTransaction.encode())
        .with('operation', Operation.CALL)
        .build();
      const dataDecoded = dataDecodedBuilder().build();
      const contract = contractBuilder()
        .with('address', previewTransactionDto.to)
        .build();
      const tokenResponse = tokenBuilder()
        .with('address', ComposableCowAddress)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${buyToken.address}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${sellToken.address}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/app_data/${appDataHash}`) {
          return Promise.resolve({ data: rawify(fullAppData), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contract.address}`
        ) {
          return Promise.resolve({ data: rawify(contract), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${twapTransaction.to}`
        ) {
          return Promise.resolve({ data: rawify(tokenResponse), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect({
          txInfo: {
            type: 'TwapOrder',
            humanDescription: null,
            status: 'presignaturePending',
            kind: 'sell',
            class: 'limit',
            activeOrderUid: null,
            validUntil: Math.ceil(now.getTime() / 1_000) + 3599,
            sellAmount: '427173750967724283500',
            buyAmount: '1222579021996502268',
            executedSellAmount: '0',
            executedBuyAmount: '0',
            executedSurplusFee: '0',
            sellToken: {
              address: sellToken.address,
              decimals: sellToken.decimals,
              logoUri: sellToken.logoUri,
              name: sellToken.name,
              symbol: sellToken.symbol,
              trusted: sellToken.trusted,
            },
            buyToken: {
              address: buyToken.address,
              decimals: buyToken.decimals,
              logoUri: buyToken.logoUri,
              name: buyToken.name,
              symbol: buyToken.symbol,
              trusted: buyToken.trusted,
            },
            receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
            owner: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
            fullAppData: appData,
            numberOfParts: '2',
            partSellAmount: '213586875483862141750',
            minPartLimit: '611289510998251134',
            timeBetweenParts: 1800,
            durationOfPart: { durationType: 'AUTO' },
            startTime: { startType: 'AT_MINING_TIME' },
          },
          txData: {
            hexData: previewTransactionDto.data,
            dataDecoded,
            to: {
              value: previewTransactionDto.to,
              name: contract.displayName,
              logoUri: contract.logoUri,
            },
            value: previewTransactionDto.value,
            operation: previewTransactionDto.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
        });
    });

    it('should return a "standard" transaction preview if buy token is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const dataDecoded = dataDecodedBuilder().build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('to', ComposableCowAddress)
        .with('data', data)
        .with('operation', Operation.CALL)
        .build();
      const contract = contractBuilder()
        .with('address', ComposableCowAddress)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${buyToken.address}`
        ) {
          return Promise.reject({ status: 500 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${sellToken.address}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/app_data/${appDataHash}`) {
          return Promise.resolve({ data: rawify(fullAppData), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contract.address}`
        ) {
          return Promise.resolve({ data: rawify(contract), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });

    it('should return a "standard" transaction preview if sell token is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const dataDecoded = dataDecodedBuilder().build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('to', ComposableCowAddress)
        .with('data', data)
        .with('operation', Operation.CALL)
        .build();
      const contract = contractBuilder()
        .with('address', ComposableCowAddress)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${buyToken.address}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${sellToken.address}`
        ) {
          return Promise.reject({ status: 500 });
        }
        if (url === `${swapsApiUrl}/api/v1/app_data/${appDataHash}`) {
          return Promise.resolve({ data: rawify(fullAppData), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contract.address}`
        ) {
          return Promise.resolve({ data: rawify(contract), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });

    it('should return a "standard" transaction preview if the swap app is restricted', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const dataDecoded = dataDecodedBuilder().build();
      const previewTransactionDto = previewTransactionDtoBuilder()
        .with('to', ComposableCowAddress)
        .with('data', data)
        .with('operation', Operation.CALL)
        .build();
      const contract = contractBuilder()
        .with('address', ComposableCowAddress)
        .build();
      const fullAppData = {
        fullAppData: JSON.stringify({
          appCode:
            // We don't use buzzNoun here as it can generate the same value as swapsVerifiedApp
            'restricted app code',
        }),
      };
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${buyToken.address}`
        ) {
          return Promise.resolve({ data: rawify(buyToken), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${sellToken.address}`
        ) {
          return Promise.resolve({ data: rawify(sellToken), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/app_data/${appDataHash}`) {
          return Promise.resolve({ data: rawify(fullAppData), status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/contracts/${contract.address}`
        ) {
          return Promise.resolve({ data: rawify(contract), status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: rawify(dataDecoded),
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
        )
        .send(previewTransactionDto)
        .expect(200)
        .expect(({ body }) => expect(body.txInfo.type).toBe('Custom'));
    });
  });
});
