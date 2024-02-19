import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { Hex, getAddress } from 'viem';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  disableModuleEncoder,
  enableModuleEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  setFallbackHandlerEncoder,
  setGuardEncoder,
  setupEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/contracts/__tests__/safe-encoder.builder';
import { erc20TransferEncoder } from '@/domain/contracts/contracts/__tests__/erc20-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/contracts/__tests__/multi-send-encoder.builder';
import {
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
} from '@safe-global/safe-deployments';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/proxy-factory-encoder.builder';

const SAFE_VERSIONS = ['1.0.0', '1.1.1', '1.2.0', '1.3.0', '1.4.1'];
const SAFE_L2_VERSIONS = ['1.3.0', '1.4.1'];
const MULTI_SEND_CALL_ONLY_VERSIONS = ['1.3.0', '1.4.1'];
const MULTI_SEND_VERSIONS = ['1.1.1', ...MULTI_SEND_CALL_ONLY_VERSIONS];
const PROXY_FACTORY_VERSIONS = ['1.0.0', '1.1.1', '1.3.0', '1.4.1'];

describe('Relay controller', () => {
  let app: INestApplication;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let safeConfigUrl: string;
  let relayUrl: string;
  const supportedChainIds = Object.keys(configuration().relay.apiKey);

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        relay: true,
      },
      relay: {
        ...defaultConfiguration.relay,
        limit: 5,
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

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    relayUrl = configurationService.getOrThrow('relay.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/chains/:chainId/relay', () => {
    describe('Relayer', () => {
      describe('Safe', () => {
        describe.each(SAFE_VERSIONS)('v%s execTransaction', (version) => {
          it('should return 201 when sending native currency to another party', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('value', faker.number.bigInt())
              .encode() as Hex;
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
              })
              .expect(201)
              .expect({
                taskId,
              });
          });

          it('should return 201 with manual gasLimit', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const gasLimit = faker.number.bigInt();
            const data = execTransactionEncoder().encode() as Hex;
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
                gasLimit: gasLimit.toString(),
              })
              .expect(201)
              .expect({
                taskId,
              });

            // The gasLimit should have a buffer added
            const expectedGasLimit = (
              BigInt(gasLimit) + BigInt(150_000)
            ).toString();
            expect(networkService.post).toHaveBeenCalledWith(
              `${relayUrl}/relays/v2/sponsored-call`,
              expect.objectContaining({
                gasLimit: expectedGasLimit,
              }),
            );
          });

          it.each([
            [
              'sending ERC-20 tokens to another party',
              erc20TransferEncoder().encode(),
            ],
            ['cancelling a transaction', '0x' as const],
            [
              'making an addOwnerWithThreshold call',
              addOwnerWithThresholdEncoder().encode(),
            ],
            [
              'making a changeThreshold call',
              changeThresholdEncoder().encode(),
            ],
            ['making an enableModule call', enableModuleEncoder().encode()],
            ['making a disableModule call', disableModuleEncoder().encode()],
            ['making a removeOwner call', removeOwnerEncoder().encode()],
            [
              'making a setFallbackHandler call',
              setFallbackHandlerEncoder().encode(),
            ],
            ['making a setGuard call', setGuardEncoder().encode()],
            ['making a swapOwner call', swapOwnerEncoder().encode()],
          ])(`should return 201 when %s`, async (_, execTransactionData) => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const data = execTransactionEncoder()
              .with('data', execTransactionData)
              .encode() as Hex;
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safe.address,
                data,
              })
              .expect(201)
              .expect({
                taskId,
              });
          });

          it('should return 201 calling execTransaction on a nested Safe', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', execTransactionEncoder().encode())
              .encode() as Hex;
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
              })
              .expect(201)
              .expect({
                taskId,
              });
          });
        });
      });

      describe('MultiSendCallOnly', () => {
        describe.each(MULTI_SEND_CALL_ONLY_VERSIONS)(
          'v%s multiSend',
          (version) => {
            it('should return 201 when entire batch is valid', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const safe = safeBuilder().build();
              const safeAddress = getAddress(safe.address);
              const transactions = [
                execTransactionEncoder()
                  .with('data', addOwnerWithThresholdEncoder().encode())
                  .encode(),
                execTransactionEncoder()
                  .with('data', changeThresholdEncoder().encode())
                  .encode(),
              ].map((data) => ({
                operation: faker.number.int({ min: 0, max: 1 }),
                data,
                to: safeAddress,
                value: faker.number.bigInt(),
              }));
              const data = multiSendEncoder()
                .with(
                  'transactions',
                  multiSendTransactionsEncoder(transactions),
                )
                .encode();
              const to = getMultiSendCallOnlyDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                    // Official mastercopy
                    return Promise.resolve({ data: safe, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });
              networkService.post.mockImplementation((url) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({ data: { taskId }, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(201)
                .expect({
                  taskId,
                });
            });
          },
        );
      });

      describe('MultiSend', () => {
        describe.each(MULTI_SEND_VERSIONS)('v%s multiSend', (version) => {
          it('should return 201 when entire batch is valid', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const transactions = [
              execTransactionEncoder()
                .with('data', addOwnerWithThresholdEncoder().encode())
                .encode(),
              execTransactionEncoder()
                .with('data', changeThresholdEncoder().encode())
                .encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: safeAddress,
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to,
                data,
              })
              .expect(201)
              .expect({
                taskId,
              });
          });
        });
      });

      describe('ProxyFactory', () => {
        describe.each(PROXY_FACTORY_VERSIONS)(
          'v%s createProxyWithNonce',
          (version) => {
            it('should return the limit addresses when creating an official Safe', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = getSafeSingletonDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const to = faker.finance.ethereumAddress();
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });
              networkService.post.mockImplementation((url) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({ data: { taskId }, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(201)
                .expect({
                  taskId,
                });
            });

            if (SAFE_L2_VERSIONS.includes(version)) {
              it('should return the limit addresses when creating an official L2 Safe', async () => {
                const chainId = faker.helpers.arrayElement(supportedChainIds);
                const chain = chainBuilder().with('chainId', chainId).build();
                const owners = [
                  getAddress(faker.finance.ethereumAddress()),
                  getAddress(faker.finance.ethereumAddress()),
                ];
                const singleton = getSafeL2SingletonDeployment({
                  version,
                  network: chainId,
                })!.networkAddresses[chainId];
                const to = faker.finance.ethereumAddress();
                const data = createProxyWithNonceEncoder()
                  .with('singleton', getAddress(singleton))
                  .with(
                    'initializer',
                    setupEncoder().with('owners', owners).encode(),
                  )
                  .encode();
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation((url) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({ data: chain, status: 200 });
                    default:
                      fail(`Unexpected URL: ${url}`);
                  }
                });
                networkService.post.mockImplementation((url) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: { taskId },
                        status: 200,
                      });
                    default:
                      fail(`Unexpected URL: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version,
                    to,
                    data,
                  })
                  .expect(201)
                  .expect({
                    taskId,
                  });
              });
            }
          },
        );
      });
    });

    describe('Transaction validation', () => {
      describe('Safe', () => {
        describe.each(SAFE_VERSIONS)('v%s execTransaction', (version) => {
          // execTransaction
          it('should return 422 when sending native currency to self', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('value', faker.number.bigInt())
              .encode() as Hex;
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
              })
              .expect(422)
              .expect({
                message:
                  'Invalid transfer. The proposed transfer is not an execTransaction, multiSend, or createProxyWithNonce call.',
                statusCode: 422,
              });
          });

          // transfer (execTransaction)
          it('should return 422 sending ERC-20 tokens to self', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with(
                'data',
                erc20TransferEncoder().with('to', safeAddress).encode(),
              )
              .encode() as Hex;
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
              })
              .expect(422)
              .expect({
                message:
                  'Invalid transfer. The proposed transfer is not an execTransaction, multiSend, or createProxyWithNonce call.',
                statusCode: 422,
              });
          });

          // Unofficial mastercopy
          it('should return 422 when the mastercopy is not official', async () => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safeAddress = faker.finance.ethereumAddress();
            const data = execTransactionEncoder()
              .with('value', faker.number.bigInt())
              .encode() as Hex;
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Unofficial mastercopy
                  return Promise.reject(new Error('Not found'));
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
              })
              .expect(422)
              .expect({
                message: 'Unsupported base contract.',
                statusCode: 422,
              });
          });
        });
      });

      describe('MultiSendCallOnly', () => {
        describe.each(MULTI_SEND_CALL_ONLY_VERSIONS)(
          'v%s multiSend',
          (version) => {
            it('should return 422 when the batch has an invalid transaction', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const safe = safeBuilder().build();
              const transactions = [
                execTransactionEncoder().encode(),
                // Native ERC-20 transfer
                erc20TransferEncoder().encode(),
              ].map((data) => ({
                operation: faker.number.int({ min: 0, max: 1 }),
                data,
                to: getAddress(safe.address),
                value: faker.number.bigInt(),
              }));
              const data = multiSendEncoder()
                .with(
                  'transactions',
                  multiSendTransactionsEncoder(transactions),
                )
                .encode();
              const to = getMultiSendCallOnlyDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                    // Official mastercopy
                    return Promise.resolve({ data: safe, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });
              networkService.post.mockImplementation((url) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: { taskId },
                      status: 200,
                    });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(422)
                .expect({
                  message:
                    'Invalid multiSend call. The batch is not all execTransaction calls to same address.',
                  statusCode: 422,
                });
            });

            it('should return 422 when the mastercopy is not official', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const safe = safeBuilder().build();
              const safeAddress = getAddress(safe.address);
              const transactions = [
                execTransactionEncoder()
                  .with('data', addOwnerWithThresholdEncoder().encode())
                  .encode(),
                execTransactionEncoder()
                  .with('data', changeThresholdEncoder().encode())
                  .encode(),
              ].map((data) => ({
                operation: faker.number.int({ min: 0, max: 1 }),
                data,
                to: safeAddress,
                value: faker.number.bigInt(),
              }));
              const data = multiSendEncoder()
                .with(
                  'transactions',
                  multiSendTransactionsEncoder(transactions),
                )
                .encode();
              const to = getMultiSendCallOnlyDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                    // Unofficial mastercopy
                    return Promise.reject(new Error('Not found'));
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(422)
                .expect({
                  message: 'Unsupported base contract.',
                  statusCode: 422,
                });
            });

            it('should return 422 when the batch is to varying parties', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const safe = safeBuilder().build();
              const safeAddress = getAddress(safe.address);
              const otherParty = getAddress(faker.finance.ethereumAddress());
              const transactions = [
                execTransactionEncoder().with('to', safeAddress).encode(),
                execTransactionEncoder().with('to', otherParty).encode(),
              ].map((data, i) => ({
                operation: faker.number.int({ min: 0, max: 1 }),
                data,
                // Varying parties
                to: i === 0 ? safeAddress : otherParty,
                value: faker.number.bigInt(),
              }));
              const data = multiSendEncoder()
                .with(
                  'transactions',
                  multiSendTransactionsEncoder(transactions),
                )
                .encode();
              const to = getMultiSendCallOnlyDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                    // Unofficial mastercopy
                    return Promise.reject(new Error('Not found'));
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(422)
                .expect({
                  message:
                    'Invalid multiSend call. The batch is not all execTransaction calls to same address.',
                  statusCode: 422,
                });
            });

            it('should return 422 for unofficial MultiSend deployments', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const safe = safeBuilder().build();
              const safeAddress = getAddress(safe.address);
              const transactions = [
                execTransactionEncoder()
                  .with('data', addOwnerWithThresholdEncoder().encode())
                  .encode(),
                execTransactionEncoder()
                  .with('data', changeThresholdEncoder().encode())
                  .encode(),
              ].map((data) => ({
                operation: faker.number.int({ min: 0, max: 1 }),
                data,
                to: safeAddress,
                value: faker.number.bigInt(),
              }));
              const data = multiSendEncoder()
                .with(
                  'transactions',
                  multiSendTransactionsEncoder(transactions),
                )
                .encode();
              // Unofficial MultiSend deployment
              const to = faker.finance.ethereumAddress();
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                    // Official mastercopy
                    return Promise.resolve({ data: safe, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(422)
                .expect({
                  message: 'Unofficial MultiSend contract.',
                  statusCode: 422,
                });
            });
          },
        );
      });

      describe('ProxyFactory', () => {
        describe.each(PROXY_FACTORY_VERSIONS)(
          'v%s createProxyWithNonce',
          (version) => {
            it('should return 422 creating an unofficial Safe', async () => {
              const chainId = faker.helpers.arrayElement(supportedChainIds);
              const chain = chainBuilder().with('chainId', chainId).build();
              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = faker.finance.ethereumAddress();
              const to = faker.finance.ethereumAddress();
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              networkService.get.mockImplementation((url) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({ data: chain, status: 200 });
                  default:
                    fail(`Unexpected URL: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to,
                  data,
                })
                .expect(422)
                .expect({
                  message:
                    'Invalid transfer. The proposed transfer is not an execTransaction, multiSend, or createProxyWithNonce call.',
                  statusCode: 422,
                });
            });
          },
        );
      });

      it('should otherwise return 422', async () => {
        // Version supported by all contracts
        const version = '1.3.0';
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = erc20TransferEncoder().encode();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            version,
            to: safeAddress,
            data,
          })
          .expect(422)
          .expect({
            message:
              'Invalid transfer. The proposed transfer is not an execTransaction, multiSend, or createProxyWithNonce call.',
            statusCode: 422,
          });
      });
    });

    describe('Rate limiting', () => {
      describe('Safe', () => {
        it.each(SAFE_VERSIONS)(
          'should increment the rate limit counter of v%s execTransaction calls',
          async (version) => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('value', faker.number.bigInt())
              .encode() as Hex;
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to: safeAddress,
                data,
              });

            await request(app.getHttpServer())
              .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
              .expect(({ body }) => {
                expect(body).toMatchObject({
                  remaining: 4,
                });
              });
          },
        );
      });

      describe('MultiSendCallOnly', () => {
        it.each(MULTI_SEND_CALL_ONLY_VERSIONS)(
          'should increment the rate limit counter of v%s multiSend calls',
          async (version) => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const transactions = [
              execTransactionEncoder()
                .with('data', addOwnerWithThresholdEncoder().encode())
                .encode(),
              execTransactionEncoder()
                .with('data', changeThresholdEncoder().encode())
                .encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: safeAddress,
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendCallOnlyDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                  // Official mastercopy
                  return Promise.resolve({ data: safe, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to,
                data,
              });

            await request(app.getHttpServer())
              .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
              .expect(({ body }) => {
                expect(body).toMatchObject({
                  remaining: 4,
                });
              });
          },
        );
      });

      describe('ProxyFactory', () => {
        it.each(PROXY_FACTORY_VERSIONS)(
          'should increment the rate limit counter of the owners of a v%s createProxyWithNonce call',
          async (version) => {
            const chainId = faker.helpers.arrayElement(supportedChainIds);
            const chain = chainBuilder().with('chainId', chainId).build();

            const owners = [
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ];
            const singleton = getSafeSingletonDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            const to = faker.finance.ethereumAddress();
            const data = createProxyWithNonceEncoder()
              .with('singleton', getAddress(singleton))
              .with(
                'initializer',
                setupEncoder().with('owners', owners).encode(),
              )
              .encode();
            const taskId = faker.string.uuid();
            networkService.get.mockImplementation((url) => {
              switch (url) {
                case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                  return Promise.resolve({ data: chain, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });
            networkService.post.mockImplementation((url) => {
              switch (url) {
                case `${relayUrl}/relays/v2/sponsored-call`:
                  return Promise.resolve({ data: { taskId }, status: 200 });
                default:
                  fail(`Unexpected URL: ${url}`);
              }
            });

            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                version,
                to,
                data,
              });

            for (const owner of owners) {
              await request(app.getHttpServer())
                .get(`/v1/chains/${chain.chainId}/relay/${owner}`)
                .expect(({ body }) => {
                  expect(body).toMatchObject({
                    remaining: 4,
                  });
                });
            }
          },
        );
      });

      it('should handle both checksummed and non-checksummed addresses', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const nonChecksummedAddress = safe.address.toLowerCase();
        const checksummedSafeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${nonChecksummedAddress}`:
            case `${chain.transactionService}/api/v1/safes/${checksummedSafeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        for (const address of [nonChecksummedAddress, checksummedSafeAddress]) {
          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: address,
              data,
            });
        }

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/relay/${nonChecksummedAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 3,
            });
          });
        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/relay/${checksummedSafeAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 3,
            });
          });
      });

      it('should not rate limit the same address on different chains', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const differentChainId = faker.string.numeric({ exclude: chainId });
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          });

        await request(app.getHttpServer())
          .get(`/v1/chains/${differentChainId}/relay/${safeAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 5,
            });
          });
      });

      it('should return 429 if the rate limit is reached', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _ of Array.from({ length: 5 })) {
          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            });
        }

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          })
          .expect(429)
          .expect({
            message: `Relay limit reached for ${safeAddress}`,
            statusCode: 429,
          });
      });
    });

    it('should return 503 if the relayer throws', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const chain = chainBuilder().with('chainId', chainId).build();
      const safe = safeBuilder().build();
      const data = execTransactionEncoder().encode() as Hex;
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            // Official mastercopy
            return Promise.resolve({ data: safe, status: 200 });
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });
      networkService.post.mockImplementation((url) => {
        switch (url) {
          case `${relayUrl}/relays/v2/sponsored-call`:
            return Promise.reject(new Error('Relayer error'));
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/relay`)
        .send({
          to: safe.address,
          data,
        })
        .expect(503);
    });
  });

  describe('GET /v1/chains/:chainId/relay/:safeAddress', () => {
    it('should return the limit and remaining relay attempts', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/relay/${safeAddress}`)
        .expect(200)
        .expect({ remaining: 5, limit: 5 });
    });

    it('should not return negative limits if more requests were made than the limit', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const chain = chainBuilder().with('chainId', chainId).build();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('value', faker.number.bigInt())
        .encode() as Hex;
      const taskId = faker.string.uuid();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            // Official mastercopy
            return Promise.resolve({ data: safe, status: 200 });
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });
      networkService.post.mockImplementation((url) => {
        switch (url) {
          case `${relayUrl}/relays/v2/sponsored-call`:
            return Promise.resolve({ data: { taskId }, status: 200 });
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of Array.from({ length: 6 })) {
        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          });
      }

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
        .expect(200)
        .expect({
          // Not negative
          remaining: 0,
          limit: 5,
        });
    });
  });

  // Fail-safes to ensure the latest version is being tested
  describe('The latest deployments are being tested', () => {
    it('should be testing the latest Safe version', () => {
      const version = SAFE_VERSIONS.at(-1);
      const deployment = getSafeSingletonDeployment({
        version,
      });

      expect(deployment?.version).toEqual(version);
    });

    it('should be testing the latest L2 Safe version', () => {
      const version = SAFE_L2_VERSIONS.at(-1);
      const deployment = getSafeL2SingletonDeployment({
        version,
      });

      expect(deployment?.version).toEqual(version);
    });

    it('should be testing the latest MultiSendCallOnly version', () => {
      const version = MULTI_SEND_CALL_ONLY_VERSIONS.at(-1);
      const deployment = getMultiSendCallOnlyDeployment({
        version,
      });

      expect(deployment?.version).toEqual(version);
    });

    it('should be testing the latest MultiSend version', () => {
      const version = MULTI_SEND_VERSIONS.at(-1);
      const deployment = getMultiSendDeployment({
        version,
      });

      expect(deployment?.version).toEqual(version);
    });

    it('should be testing the latest MultiSend version', () => {
      const version = PROXY_FACTORY_VERSIONS.at(-1);
      const deployment = getProxyFactoryDeployment({
        version,
      });

      expect(deployment?.version).toEqual(version);
    });
  });
});
