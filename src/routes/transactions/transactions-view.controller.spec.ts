import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { dedicatedStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { StakeState } from '@/datasources/staking-api/entities/stake.entity';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { getNumberString } from '@/domain/common/utils/utils';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { setPreSignatureEncoder } from '@/domain/swaps/contracts/__tests__/encoders/gp-v2-encoder.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { Server } from 'net';
import request from 'supertest';
import { concat, encodeFunctionData, getAddress, parseAbi } from 'viem';

describe('TransactionsViewController tests', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let swapsApiUrl: string;
  let stakingApiUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  const swapsVerifiedApp = faker.company.buzzNoun();
  const swapsChainId = '1';

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
    swapsApiUrl = configurationService.getOrThrow(`swaps.api.${swapsChainId}`);
    stakingApiUrl = configurationService.getOrThrow('staking.mainnet.baseUri');
    networkService = moduleFixture.get(NetworkService);
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Gets Generic confirmation view', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: '0x',
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  describe('Swaps', () => {
    it('Gets swap confirmation view with swap data', async () => {
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            type: 'COW_SWAP_ORDER',
            method: dataDecoded.method,
            parameters: dataDecoded.parameters,
            uid: order.uid,
            status: order.status,
            kind: order.kind,
            orderClass: order.class,
            validUntil: order.validTo,
            sellAmount: order.sellAmount.toString(),
            buyAmount: order.buyAmount.toString(),
            executedSellAmount: order.executedSellAmount.toString(),
            executedBuyAmount: order.executedBuyAmount.toString(),
            explorerUrl: expect.any(String),
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
          }),
        );
    });

    it('gets TWAP confirmation view with TWAP data', async () => {
      const ComposableCowAddress = '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74';
      /**
       * @see https://sepolia.etherscan.io/address/0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74
       */
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder()
        .with('address', '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381')
        .build();
      const data =
        '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011f294a00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b1400000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000b941d039eed310b36000000000000000000000000000000000000000000000000087bbc924df9167e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000007080000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000';
      const appDataHash =
        '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0';
      const fullAppData = {
        fullAppData: JSON.stringify({ appCode: swapsVerifiedApp }),
      };
      const dataDecoded = dataDecodedBuilder().build();
      const buyToken = tokenBuilder()
        .with(
          'address',
          getAddress('0xfff9976782d46cc05630d1f6ebab18b2324d6b14'),
        )
        .build();
      const sellToken = tokenBuilder()
        .with(
          'address',
          getAddress('0xbe72e441bf55620febc26715db68d3494213d8cb'),
        )
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data,
          to: ComposableCowAddress,
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            type: 'COW_SWAP_TWAP_ORDER',
            method: dataDecoded.method,
            parameters: dataDecoded.parameters,
          }),
        );
    });

    it('Gets Generic confirmation view if order data is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.reject({ status: 500 });
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('Gets Generic confirmation view if buy token data is not available', async () => {
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('Gets Generic confirmation view if sell token data is not available', async () => {
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('Gets Generic confirmation view if swap app is restricted', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        // We don't use buzzNoun here as it can generate the same value as verifiedApp
        .with('fullAppData', `{ "appCode": "restricted app code" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('executedSurplusFee is rendered as null if not available', async () => {
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
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            type: 'COW_SWAP_ORDER',
            executedSurplusFee: null,
          }),
        );
    });
  });

  describe('Staking', () => {
    describe('Native', () => {
      describe('deposit', () => {
        it('returns the native staking `deposit` confirmation view for proposal', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const networkStats = networkStatsBuilder().build();
          // Transaction being proposed (no stakes exists)
          const stakes: Array<Stake> = [];
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          const value = getNumberString(64 * 10 ** 18 + 1);
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/kiln-stats`:
                return Promise.resolve({
                  data: rawify({ data: dedicatedStakingStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: rawify({ data: networkStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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

          const annualNrr =
            dedicatedStakingStats.gross_apy.last_30d *
            (1 - Number(deployment.product_fee));
          const monthlyNrr = annualNrr / 12;
          const expectedAnnualReward = (annualNrr / 100) * Number(value);
          const expectedMonthlyReward = expectedAnnualReward / 12;
          const expectedFiatAnnualReward =
            (expectedAnnualReward * networkStats.eth_price_usd) /
            Math.pow(10, chain.nativeCurrency.decimals);
          const expectedFiatMonthlyReward = expectedFiatAnnualReward / 12;

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
              value,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_DEPOSIT',
              method: dataDecoded.method,
              status: 'NOT_STAKED',
              parameters: dataDecoded.parameters,
              estimatedEntryTime:
                networkStats.estimated_entry_time_seconds * 1_000,
              estimatedExitTime:
                networkStats.estimated_exit_time_seconds * 1_000,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds * 1_000,
              fee: +deployment.product_fee!,
              monthlyNrr,
              annualNrr,
              value,
              numValidators: 2,
              expectedAnnualReward: getNumberString(expectedAnnualReward),
              expectedMonthlyReward: getNumberString(expectedMonthlyReward),
              expectedFiatAnnualReward,
              expectedFiatMonthlyReward,
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
            });
        });
        it('returns the native staking `deposit` confirmation view', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const networkStats = networkStatsBuilder().build();
          const stakes = [
            stakeBuilder().with('state', StakeState.Unstaked).build(),
          ];
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          const value = getNumberString(64 * 10 ** 18 + 1);
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/kiln-stats`:
                return Promise.resolve({
                  data: rawify({ data: dedicatedStakingStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: rawify({ data: networkStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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

          const annualNrr =
            dedicatedStakingStats.gross_apy.last_30d *
            (1 - Number(deployment.product_fee));
          const monthlyNrr = annualNrr / 12;
          const expectedAnnualReward = (annualNrr / 100) * Number(value);
          const expectedMonthlyReward = expectedAnnualReward / 12;
          const expectedFiatAnnualReward =
            (expectedAnnualReward * networkStats.eth_price_usd) /
            Math.pow(10, chain.nativeCurrency.decimals);
          const expectedFiatMonthlyReward = expectedFiatAnnualReward / 12;

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
              value,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_DEPOSIT',
              method: dataDecoded.method,
              status: 'NOT_STAKED',
              parameters: dataDecoded.parameters,
              estimatedEntryTime:
                networkStats.estimated_entry_time_seconds * 1_000,
              estimatedExitTime:
                networkStats.estimated_exit_time_seconds * 1_000,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds * 1_000,
              fee: +deployment.product_fee!,
              monthlyNrr,
              annualNrr,
              value,
              numValidators: 2,
              expectedAnnualReward: getNumberString(expectedAnnualReward),
              expectedMonthlyReward: getNumberString(expectedMonthlyReward),
              expectedFiatAnnualReward,
              expectedFiatMonthlyReward,
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
            });
        });

        it('returns the native staking `deposit` confirmation view using local decoding', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const networkStats = networkStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          // Transaction being proposed (no stakes exists)
          const stakes: Array<Stake> = [];
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          const value = getNumberString(64 * 10 ** 18 + 1);
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/kiln-stats`:
                return Promise.resolve({
                  data: rawify({ data: dedicatedStakingStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: rawify({ data: networkStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.reject(new ServiceUnavailableException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          const annualNrr =
            dedicatedStakingStats.gross_apy.last_30d *
            (1 - Number(deployment.product_fee));
          const monthlyNrr = annualNrr / 12;
          const expectedAnnualReward = (annualNrr / 100) * Number(value);
          const expectedMonthlyReward = expectedAnnualReward / 12;
          const expectedFiatAnnualReward =
            (expectedAnnualReward * networkStats.eth_price_usd) /
            Math.pow(10, chain.nativeCurrency.decimals);
          const expectedFiatMonthlyReward = expectedFiatAnnualReward / 12;

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
              value,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_DEPOSIT',
              method: 'deposit',
              status: 'NOT_STAKED',
              parameters: [],
              estimatedEntryTime:
                networkStats.estimated_entry_time_seconds * 1_000,
              estimatedExitTime:
                networkStats.estimated_exit_time_seconds * 1_000,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds * 1_000,
              fee: +deployment.product_fee!,
              monthlyNrr,
              annualNrr,
              value,
              numValidators: 2,
              expectedAnnualReward: getNumberString(expectedAnnualReward),
              expectedMonthlyReward: getNumberString(expectedMonthlyReward),
              expectedFiatAnnualReward,
              expectedFiatMonthlyReward,
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
            });
        });

        it('returns the dedicated staking `deposit` confirmation view from batch', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const networkStats = networkStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          // Transaction being proposed (no stakes exists)
          const stakes: Array<Stake> = [];
          const depositData = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          const multiSendAddress = getAddress(faker.finance.ethereumAddress());
          const multiSendData = multiSendEncoder()
            .with(
              'transactions',
              multiSendTransactionsEncoder([
                {
                  to: deployment.address,
                  data: depositData,
                  value: BigInt(0),
                  operation: 0,
                },
              ]),
            )
            .encode();
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: rawify({ data: networkStats }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/stakes`) {
              return Promise.resolve({
                data: rawify({ data: stakes }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: multiSendAddress,
              data: multiSendData,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_DEPOSIT',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              status: 'NOT_STAKED',
              estimatedEntryTime:
                networkStats.estimated_entry_time_seconds * 1_000,
              estimatedExitTime:
                networkStats.estimated_exit_time_seconds * 1_000,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds * 1_000,
              fee: +deployment.product_fee!,
              monthlyNrr:
                (dedicatedStakingStats.gross_apy.last_30d *
                  (1 - +deployment.product_fee!)) /
                12,
              annualNrr:
                dedicatedStakingStats.gross_apy.last_30d *
                (1 - +deployment.product_fee!),
              value: '0', // defaults to 0 if not provided in the request
              numValidators: 0, // 0 as value is 0
              expectedMonthlyReward: '0', // 0 as value is 0
              expectedAnnualReward: '0', // 0 as value is 0
              expectedFiatMonthlyReward: 0, // 0 as value is 0
              expectedFiatAnnualReward: 0, // 0 as value is 0
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
            });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.reject(new NotFoundException());
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not dedicated-specific', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling') // Pooling
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if not transacting with a deployment address', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const to = faker.finance.ethereumAddress(); // Not deployment.address, ergo "unknown"
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment has no product fee', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', null) // No product fee
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the dedicated staking stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const networkStats = networkStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.reject(new NotFoundException());
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: rawify({ data: networkStats }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the network stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.reject(new NotFoundException());
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });
      });

      describe('validators exit', () => {
        it('returns the native staking `validators exit` confirmation view', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const networkStats = networkStatsBuilder().build();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [validatorPublicKey],
          });
          const dataDecoded = dataDecodedBuilder()
            .with('method', 'requestValidatorsExit')
            .with('parameters', [
              {
                name: '_publicKeys',
                type: 'bytes',
                value: validatorPublicKey,
                valueDecoded: null,
              },
            ])
            .build();
          const stakes = [
            stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
            stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
          ];
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: rawify({ data: networkStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_VALIDATORS_EXIT',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              status: 'ACTIVE',
              estimatedExitTime:
                networkStats.estimated_exit_time_seconds * 1_000,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds * 1_000,
              value: '64000000000000000000', // 2 x 32 ETH,
              numValidators: 2,
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
              validators,
            });

          // check the public keys are passed to the staking service in the expected format
          expect(networkService.get).toHaveBeenNthCalledWith(3, {
            url: `${stakingApiUrl}/v1/eth/stakes`,
            networkRequest: expect.objectContaining({
              params: {
                onchain_v1_include_net_rewards: true,
                validators: validators.join(','),
              },
            }),
          });
        });

        it('returns the native staking `validators exit` confirmation view using local decoding', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const networkStats = networkStatsBuilder().build();
          const validatorPublicKey = faker.string
            .hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            })
            .toLowerCase();
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [validatorPublicKey as `0x${string}`],
          });
          const stakes = [
            stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
            stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
          ];
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: rawify({ data: networkStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.reject(new ServiceUnavailableException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_VALIDATORS_EXIT',
              method: 'requestValidatorsExit',
              parameters: [
                {
                  name: '_publicKeys',
                  type: 'bytes',
                  value: validatorPublicKey,
                  valueDecoded: null,
                },
              ],
              status: 'ACTIVE',
              estimatedExitTime:
                networkStats.estimated_exit_time_seconds * 1_000,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds * 1_000,
              value: '32000000000000000000', // 32 ETH,
              numValidators: 1,
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
              validators: [validatorPublicKey],
            });

          // check the public keys are passed to the staking service in the expected format
          expect(networkService.get).toHaveBeenNthCalledWith(3, {
            url: `${stakingApiUrl}/v1/eth/stakes`,
            networkRequest: expect.objectContaining({
              params: {
                onchain_v1_include_net_rewards: true,
                validators: validatorPublicKey,
              },
            }),
          });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [faker.string.hexadecimal() as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.reject(new NotFoundException());
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: faker.finance.ethereumAddress(),
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not dedicated-specific', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi') // Not dedicated
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [faker.string.hexadecimal() as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [faker.string.hexadecimal() as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if not transacting with a deployment address', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const to = faker.finance.ethereumAddress(); // Not deployment.address, ergo "unknown"
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [faker.string.hexadecimal() as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the network stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const to = faker.finance.ethereumAddress(); // Not deployment.address, ergo "unknown"
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [faker.string.hexadecimal() as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: rawify(chain), status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: rawify({ data: [deployment] }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.reject(new NotFoundException());
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the stakes are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const networkStats = networkStatsBuilder().build();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [validatorPublicKey],
          });
          const dataDecoded = dataDecodedBuilder()
            .with('method', 'requestValidatorsExit')
            .with('parameters', [
              {
                name: '_publicKeys',
                type: 'bytes',
                value: validatorPublicKey,
                valueDecoded: null,
              },
            ])
            .build();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: rawify({ data: networkStats }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.reject(new ServiceUnavailableException());
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });

          // check the public keys are passed to the staking service in the expected format
          expect(networkService.get).toHaveBeenNthCalledWith(3, {
            url: `${stakingApiUrl}/v1/eth/stakes`,
            networkRequest: expect.objectContaining({
              params: {
                onchain_v1_include_net_rewards: true,
                validators: validators.join(','),
              },
            }),
          });
        });
      });

      describe('withdraw', () => {
        it('returns the native staking `withdraw` confirmation view', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey],
          });
          const dataDecoded = dataDecodedBuilder()
            .with('method', 'batchWithdrawCLFee')
            .with('parameters', [
              {
                name: '_publicKeys',
                type: 'bytes',
                value: validatorPublicKey,
                valueDecoded: null,
              },
            ])
            .build();
          const stakes = [
            stakeBuilder()
              .with('net_claimable_consensus_rewards', '1000000')
              .build(),
            stakeBuilder()
              .with('net_claimable_consensus_rewards', '2000000')
              .build(),
          ];
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_WITHDRAW',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              value: (
                +stakes[0].net_claimable_consensus_rewards! +
                +stakes[1].net_claimable_consensus_rewards!
              ).toString(),
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
              validators,
            });
        });

        it('returns the native staking `withdraw` confirmation view using local decoding', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey],
          });
          const stakes = [
            stakeBuilder()
              .with('net_claimable_consensus_rewards', '6000000')
              .build(),
            stakeBuilder()
              .with('net_claimable_consensus_rewards', '2000000')
              .build(),
          ];
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: rawify({ data: stakes }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.reject(new ServiceUnavailableException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_NATIVE_STAKING_WITHDRAW',
              method: 'batchWithdrawCLFee',
              parameters: [
                {
                  name: '_publicKeys',
                  type: 'bytes',
                  value: validatorPublicKey,
                  valueDecoded: null,
                },
              ],
              value: (
                +stakes[0].net_claimable_consensus_rewards! +
                +stakes[1].net_claimable_consensus_rewards!
              ).toString(),
              tokenInfo: {
                address: NULL_ADDRESS,
                decimals: chain.nativeCurrency.decimals,
                logoUri: chain.nativeCurrency.logoUri,
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                trusted: true,
              },
              validators,
            });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const validatorPublicKey = faker.string.hexadecimal();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.reject(new NotFoundException());
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              value: faker.string.numeric(),
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not dedicated-specific', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const validatorPublicKey = faker.string.hexadecimal();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi') // Not dedicated
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              value: faker.string.numeric(),
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const validatorPublicKey = faker.string.hexadecimal();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              value: faker.string.numeric(),
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if not transacting with a deployment address', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const validatorPublicKey = faker.string.hexadecimal();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey as `0x${string}`],
          });
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: faker.finance.ethereumAddress(), // Not the deployment address
              value: faker.string.numeric(),
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the stakes are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const dataDecoded = dataDecodedBuilder()
            .with('method', 'batchWithdrawCLFee')
            .with('parameters', [
              {
                name: '_publicKeys',
                type: 'bytes',
                value: validatorPublicKey,
                valueDecoded: null,
              },
            ])
            .build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey],
          });
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: rawify({ data: [deployment] }),
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.reject(new ServiceUnavailableException());
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
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
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              value: faker.string.numeric(),
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });
      });
    });
  });
});
