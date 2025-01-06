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
import { concat } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { dedicatedStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import { StakeState } from '@/datasources/staking-api/entities/stake.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import {
  batchWithdrawCLFeeEncoder,
  depositEncoder,
  requestValidatorsExitEncoder,
} from '@/domain/staking/contracts/decoders/__tests__/encoders/kiln-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Preview transaction - Kiln - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let stakingApiUrl: string;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
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
    stakingApiUrl = configurationService.getOrThrow('staking.mainnet.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Native (dedicated) staking', () => {
    describe('deposit', () => {
      it('should preview a transaction', async () => {
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
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
            `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
          )
          .send(previewTransactionDto)
          .expect(200)
          .expect({
            txInfo: {
              type: 'NativeStakingDeposit',
              humanDescription: null,
              status: 'NOT_STAKED',
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
              validators: null,
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
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

      it('should preview a batched transaction', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const depositTransaction = {
          operation: Operation.CALL,
          data,
          to: deployment.address,
          value: BigInt(value),
        };
        const multiSendTransaction = multiSendEncoder().with(
          'transactions',
          multiSendTransactionsEncoder([depositTransaction]),
        );
        const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
        const networkStats = networkStatsBuilder().build();
        // Transaction being proposed (no stakes exists)
        const stakes: Array<Stake> = [];
        const safe = safeBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', multiSendTransaction.encode())
          .with('operation', Operation.CALL)
          .build();
        const dataDecoded = dataDecodedBuilder().build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const depositContractResponse = contractBuilder()
          .with('address', depositTransaction.to)
          .build();
        const depositTokenResponse = tokenBuilder()
          .with('address', depositTransaction.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${depositContractResponse.address}`:
              return Promise.resolve({
                data: rawify(depositContractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${depositTokenResponse.address}`:
              return Promise.resolve({
                data: rawify(depositTokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
            `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
          )
          .send(previewTransactionDto)
          .expect(200)
          .expect({
            txInfo: {
              type: 'NativeStakingDeposit',
              humanDescription: null,
              status: 'NOT_STAKED',
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
              validators: null,
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
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

      it('should return a "standard" transaction preview if the deployment is unavailable', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${stakingApiUrl}/v1/deployments`:
              return Promise.reject({
                status: 500,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment is not dedicated-specific', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'defi')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment is on an unknown chain', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('chain', 'unknown')
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if not transacting with a deployment address', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment has no product fee', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', null)
          .build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the dedicated staking stats are not available', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const networkStats = networkStatsBuilder().build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${stakingApiUrl}/v1/eth/kiln-stats`:
              return Promise.reject({
                status: 500,
              });
            case `${stakingApiUrl}/v1/eth/network-stats`:
              return Promise.resolve({
                data: rawify({ data: networkStats }),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the network stats are not available', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
        const safe = safeBuilder().build();
        const data = depositEncoder().encode();
        const value = getNumberString(64 * 10 ** 18 + 1);
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .with('value', value)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${stakingApiUrl}/v1/eth/kiln-stats`:
              return Promise.resolve({
                data: rawify({ data: dedicatedStakingStats }),
                status: 200,
              });
            case `${stakingApiUrl}/v1/eth/network-stats`:
              return Promise.reject({
                status: 500,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

    describe('requestValidatorsExit', () => {
      it('should preview a transaction', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const stakes = [
          stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
          stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
        ];
        const contractResponse = contractBuilder()
          .with('address', deployment.address)
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
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
              return Promise.resolve({
                data: rawify({ data: stakes }),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
              type: 'NativeStakingValidatorsExit',
              humanDescription: null,
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
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
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

      it('should preview a batched transaction', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const stakes = [
          stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
          stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
        ];
        const requestValidatorsExitTransaction = {
          operation: Operation.CALL,
          data,
          to: deployment.address,
          value: BigInt(0),
        };
        const multiSendTransaction = multiSendEncoder().with(
          'transactions',
          multiSendTransactionsEncoder([requestValidatorsExitTransaction]),
        );
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', multiSendTransaction.encode())
          .with('operation', Operation.CALL)
          .build();
        const dataDecoded = dataDecodedBuilder().build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const requestValidatorsExiContractResponse = contractBuilder()
          .with('address', deployment.address)
          .build();
        const requestValidatorsExitTokenResponse = tokenBuilder()
          .with('address', deployment.address)
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
              return Promise.resolve({
                data: rawify({ data: stakes }),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${requestValidatorsExiContractResponse.address}`:
              return Promise.resolve({
                data: rawify(requestValidatorsExiContractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${requestValidatorsExitTokenResponse.address}`:
              return Promise.resolve({
                data: rawify(requestValidatorsExitTokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
              type: 'NativeStakingValidatorsExit',
              humanDescription: null,
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
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
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

      it('should return a "standard" transaction preview if the deployment is unavailable', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${stakingApiUrl}/v1/deployments`:
              return Promise.reject({
                status: 500,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment is not dedicated-specific', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'defi')
          .with('product_fee', faker.number.float().toString())
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment is on an unknown chain', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('chain', 'unknown')
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('to', deployment.address)
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if not transacting with a deployment address', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the network stats are not available', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const stakes = [
          stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
          stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
        ];
        const contractResponse = contractBuilder()
          .with('address', deployment.address)
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
              return Promise.reject({
                status: 500,
              });
            case `${stakingApiUrl}/v1/eth/stakes`:
              return Promise.resolve({
                data: rawify({ data: stakes }),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the stakes are not available', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = requestValidatorsExitEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const contractResponse = contractBuilder()
          .with('address', deployment.address)
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
              return Promise.reject({
                status: 500,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

    describe('batchWithdrawCLFee', () => {
      it('should preview a transaction', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const stakes = [
          stakeBuilder()
            .with('net_claimable_consensus_rewards', '1000000')
            .build(),
          stakeBuilder()
            .with('net_claimable_consensus_rewards', '2000000')
            .build(),
        ];
        const contractResponse = contractBuilder()
          .with('address', deployment.address)
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
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
            case `${stakingApiUrl}/v1/eth/stakes`:
              return Promise.resolve({
                data: rawify({ data: stakes }),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
              type: 'NativeStakingWithdraw',
              humanDescription: null,
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
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
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

      it('should preview a batched transaction', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const batchWithdrawCLFeeTransaction = {
          operation: Operation.CALL,
          data,
          to: deployment.address,
          value: BigInt(0),
        };
        const multiSendTransaction = multiSendEncoder().with(
          'transactions',
          multiSendTransactionsEncoder([batchWithdrawCLFeeTransaction]),
        );
        const stakes = [
          stakeBuilder()
            .with('net_claimable_consensus_rewards', '1000000')
            .build(),
          stakeBuilder()
            .with('net_claimable_consensus_rewards', '2000000')
            .build(),
        ];
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', multiSendTransaction.encode())
          .with('operation', Operation.CALL)
          .build();
        const dataDecoded = dataDecodedBuilder().build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const batchWithdrawCLFeeContractResponse = contractBuilder()
          .with('address', batchWithdrawCLFeeTransaction.to)
          .build();
        const batchWithdrawCLFeeTokenResponse = tokenBuilder()
          .with('address', batchWithdrawCLFeeTransaction.to)
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
            case `${stakingApiUrl}/v1/eth/stakes`:
              return Promise.resolve({
                data: rawify({ data: stakes }),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${tokenResponse.address}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${batchWithdrawCLFeeContractResponse.address}`:
              return Promise.resolve({
                data: rawify(batchWithdrawCLFeeContractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${batchWithdrawCLFeeTokenResponse.address}`:
              return Promise.resolve({
                data: rawify(batchWithdrawCLFeeTokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
              type: 'NativeStakingWithdraw',
              humanDescription: null,
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
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
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

      it('should return a "standard" transaction preview if the deployment is unavailable', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${stakingApiUrl}/v1/deployments`:
              return Promise.reject({
                status: 500,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment is not dedicated-specific', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'defi')
          .with('product_fee', faker.number.float().toString())
          .build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the deployment is on an unknown chain', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('chain', 'unknown')
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if not transacting with a deployment address', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const safe = safeBuilder().build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        const tokenResponse = tokenBuilder()
          .with('address', previewTransactionDto.to)
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
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/tokens/${previewTransactionDto.to}`:
              return Promise.resolve({
                data: rawify(tokenResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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

      it('should return a "standard" transaction preview if the stakes are not available', async () => {
        const chain = chainBuilder().with('isTestnet', false).build();
        const deployment = deploymentBuilder()
          .with('chain_id', +chain.chainId)
          .with('product_type', 'dedicated')
          .with('product_fee', faker.number.float().toString())
          .build();
        const safe = safeBuilder().build();
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
        const data = batchWithdrawCLFeeEncoder()
          .with('_publicKeys', concat(validators))
          .encode();
        const dataDecoded = dataDecodedBuilder().build();
        const contractResponse = contractBuilder()
          .with('address', deployment.address)
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', data)
          .with('operation', Operation.CALL)
          .with('to', deployment.address)
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
            case `${stakingApiUrl}/v1/eth/stakes`:
              return Promise.reject({
                status: 500,
              });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              return Promise.resolve({
                data: rawify(safe),
                status: 200,
              });
            case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
              return Promise.resolve({
                data: rawify(contractResponse),
                status: 200,
              });
            default:
              return Promise.reject(new Error(`Could not match ${url}`));
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
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
});
