import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import type { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { getAddress } from 'viem';
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
} from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';
import {
  erc20ApproveEncoder,
  erc20TransferEncoder,
  erc20TransferFromEncoder,
} from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import {
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
  getSafeL2SingletonDeployments,
  getSafeSingletonDeployments,
} from '@/domain/common/utils/deployments';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { getDeploymentVersionsByChainIds } from '@/__tests__/deployments.helper';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import {
  execTransactionFromModuleEncoder,
  executeNextTxEncoder,
} from '@/domain/alerts/contracts/__tests__/encoders/delay-modifier-encoder.builder';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

const supportedChainIds = faker.helpers.arrayElements(
  Object.keys(configuration().relay.apiKey),
  1,
);

const SAFE_VERSIONS = getDeploymentVersionsByChainIds(
  'Safe',
  supportedChainIds,
);
const SAFE_L2_VERSIONS = getDeploymentVersionsByChainIds(
  'SafeL2',
  supportedChainIds,
);
const MULTI_SEND_CALL_ONLY_VERSIONS = getDeploymentVersionsByChainIds(
  'MultiSendCallOnly',
  supportedChainIds,
);
const MULTI_SEND_VERSIONS = getDeploymentVersionsByChainIds(
  'MultiSend',
  supportedChainIds,
);
const PROXY_FACTORY_VERSIONS = getDeploymentVersionsByChainIds(
  'ProxyFactory',
  supportedChainIds,
);

describe('Relay controller', () => {
  let app: INestApplication<Server>;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let safeConfigUrl: string;
  let relayUrl: string;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      relay: {
        ...defaultConfiguration.relay,
        limit: 5,
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

  describe.each(supportedChainIds)('Chain %s', (chainId) => {
    describe('POST /v1/chains/:chainId/relay', () => {
      describe('Relayer', () => {
        describe('Recovery', () => {
          describe.each([
            [
              'execTransactionFromModule (Proposals)',
              execTransactionFromModuleEncoder,
            ],
            ['executeNextTx (Execution)', executeNextTxEncoder],
          ])('%s', (_, encoder) => {
            it('should return 201 when executing a singular transaction', async () => {
              const chain = chainBuilder()
                .with('chainId', faker.helpers.arrayElement(supportedChainIds))
                .build();
              const safes = faker.helpers.multiple(
                () => getAddress(faker.finance.ethereumAddress()),
                { count: { min: 1, max: 4 } },
              );
              const version = faker.system.semver();
              const safeAddress = faker.helpers.arrayElement(safes);
              const data = encoder()
                .with('to', safeAddress)
                .with(
                  'data',
                  execTransactionEncoder()
                    .with('data', addOwnerWithThresholdEncoder().encode())
                    .encode(),
                )
                .encode();
              const moduleAddress = getAddress(faker.finance.ethereumAddress());
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                    return Promise.resolve({
                      data: rawify({ safes }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to: moduleAddress,
                  data,
                })
                .expect(201)
                .expect({
                  taskId,
                });
            });

            it('should return 201 when executing a batch of transactions', async () => {
              const chain = chainBuilder()
                .with('chainId', faker.helpers.arrayElement(supportedChainIds))
                .build();
              const safes = faker.helpers.multiple(
                () => getAddress(faker.finance.ethereumAddress()),
                { count: { min: 2, max: 4 } },
              );
              // We don't need to test all possible combinations as we only use the address
              // to check the officiality of the MultiSend. The rest is universal for all.
              const multiSendVersion = faker.helpers.arrayElement(
                MULTI_SEND_VERSIONS[chain.chainId],
              );
              const [multiSendAddress] = getMultiSendDeployments({
                chainId: chain.chainId,
                version: multiSendVersion,
              });
              const safeAddress = faker.helpers.arrayElement(safes);
              const data = encoder()
                .with('to', multiSendAddress)
                .with(
                  'data',
                  multiSendEncoder()
                    .with(
                      'transactions',
                      multiSendTransactionsEncoder(
                        [
                          execTransactionEncoder()
                            .with(
                              'data',
                              addOwnerWithThresholdEncoder().encode(),
                            )
                            .encode(),
                          execTransactionEncoder()
                            .with('data', changeThresholdEncoder().encode())
                            .encode(),
                        ].map((data) => ({
                          operation: faker.number.int({ min: 0, max: 1 }),
                          data,
                          to: safeAddress,
                          value: faker.number.bigInt(),
                        })),
                      ),
                    )
                    .encode(),
                )
                .encode();
              const moduleAddress = getAddress(faker.finance.ethereumAddress());
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                    return Promise.resolve({
                      data: rawify({ safes }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version: multiSendVersion,
                  to: moduleAddress,
                  data,
                })
                .expect(201)
                .expect({
                  taskId,
                });
            });
          });
        });

        describe('Safe', () => {
          describe.each(SAFE_VERSIONS[chainId])(
            'v%s execTransaction',
            (version) => {
              it('should return 201 when sending native currency to another party', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const data = execTransactionEncoder()
                  .with('value', faker.number.bigInt())
                  .encode();
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const gasLimit = faker.string.numeric({ exclude: '0' });
                const data = execTransactionEncoder().encode();
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version,
                    to: safeAddress,
                    data,
                    gasLimit,
                  })
                  .expect(201)
                  .expect({
                    taskId,
                  });

                // The gasLimit should have a buffer added
                const expectedGasLimit = (
                  BigInt(gasLimit) + BigInt(150_000)
                ).toString();
                expect(networkService.post).toHaveBeenCalledWith({
                  url: `${relayUrl}/relays/v2/sponsored-call`,
                  data: expect.objectContaining({
                    gasLimit: expectedGasLimit,
                  }),
                });
              });

              it.each([
                [
                  '`transfer`ing ERC-20 tokens to another party',
                  erc20TransferEncoder().encode(),
                ],
                [
                  '`transferFrom`ing ERC-20 tokens to another party',
                  erc20TransferFromEncoder().encode(),
                ],
                ['`approve`ing ERC-20 tokens', erc20ApproveEncoder().encode()],
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
                [
                  'making a disableModule call',
                  disableModuleEncoder().encode(),
                ],
                ['making a removeOwner call', removeOwnerEncoder().encode()],
                [
                  'making a setFallbackHandler call',
                  setFallbackHandlerEncoder().encode(),
                ],
                ['making a setGuard call', setGuardEncoder().encode()],
                ['making a swapOwner call', swapOwnerEncoder().encode()],
              ])(
                `should return 201 when %s`,
                async (_, execTransactionData) => {
                  const chain = chainBuilder().with('chainId', chainId).build();
                  const safe = safeBuilder().build();
                  const data = execTransactionEncoder()
                    .with('data', execTransactionData)
                    .encode();
                  const taskId = faker.string.uuid();
                  networkService.get.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                        return Promise.resolve({
                          data: rawify(chain),
                          status: 200,
                        });
                      case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                        // Official mastercopy
                        return Promise.resolve({
                          data: rawify(safe),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
                    }
                  });
                  networkService.post.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${relayUrl}/relays/v2/sponsored-call`:
                        return Promise.resolve({
                          data: rawify({ taskId }),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
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
                },
              );

              it('should return 201 calling execTransaction on a nested Safe', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const data = execTransactionEncoder()
                  .with('to', safeAddress)
                  .with('data', execTransactionEncoder().encode())
                  .encode();
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
            },
          );
        });

        describe('MultiSendCallOnly', () => {
          describe.each(MULTI_SEND_CALL_ONLY_VERSIONS[chainId])(
            'v%s multiSend',
            (version) => {
              it('should return 201 when entire batch is valid', async () => {
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
                const to = faker.helpers.arrayElement(
                  getMultiSendCallOnlyDeployments({
                    version,
                    chainId,
                  }),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
          describe.each(MULTI_SEND_VERSIONS[chainId])(
            'v%s multiSend',
            (version) => {
              it('should return 201 when entire batch is valid', async () => {
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
                const to = faker.helpers.arrayElement(
                  getMultiSendDeployments({
                    version,
                    chainId,
                  }),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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

        describe('ProxyFactory', () => {
          describe.each(PROXY_FACTORY_VERSIONS[chainId])(
            'v%s createProxyWithNonce',
            (version) => {
              if (SAFE_VERSIONS[chainId].includes(version)) {
                it('should return the limit addresses when creating an official Safe', async () => {
                  const chain = chainBuilder().with('chainId', chainId).build();
                  const owners = [
                    getAddress(faker.finance.ethereumAddress()),
                    getAddress(faker.finance.ethereumAddress()),
                  ];
                  const singleton = faker.helpers.arrayElement(
                    getSafeSingletonDeployments({
                      version,
                      chainId,
                    }),
                  );
                  const to = faker.helpers.arrayElement(
                    getProxyFactoryDeployments({
                      version,
                      chainId,
                    }),
                  );
                  const data = createProxyWithNonceEncoder()
                    .with('singleton', singleton)
                    .with(
                      'initializer',
                      setupEncoder().with('owners', owners).encode(),
                    )
                    .encode();
                  const taskId = faker.string.uuid();
                  networkService.get.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                        return Promise.resolve({
                          data: rawify(chain),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
                    }
                  });
                  networkService.post.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${relayUrl}/relays/v2/sponsored-call`:
                        return Promise.resolve({
                          data: rawify({ taskId }),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
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

                it('should throw when using an unofficial ProxyFactory to create an official Safe', async () => {
                  const chain = chainBuilder().with('chainId', chainId).build();
                  const owners = [
                    getAddress(faker.finance.ethereumAddress()),
                    getAddress(faker.finance.ethereumAddress()),
                  ];
                  const singleton = faker.helpers.arrayElement(
                    getSafeSingletonDeployments({
                      version,
                      chainId,
                    }),
                  );
                  // Unofficial ProxyFactory
                  const to = getAddress(faker.finance.ethereumAddress());
                  const data = createProxyWithNonceEncoder()
                    .with('singleton', singleton)
                    .with(
                      'initializer',
                      setupEncoder().with('owners', owners).encode(),
                    )
                    .encode();
                  const taskId = faker.string.uuid();
                  networkService.get.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                        return Promise.resolve({
                          data: rawify(chain),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
                    }
                  });
                  networkService.post.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${relayUrl}/relays/v2/sponsored-call`:
                        return Promise.resolve({
                          data: rawify({ taskId }),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
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
                      message: 'Unofficial ProxyFactory contract.',
                      statusCode: 422,
                    });
                });
              }

              if (SAFE_L2_VERSIONS[chainId].includes(version)) {
                it('should return the limit addresses when creating an official L2 Safe', async () => {
                  const chain = chainBuilder().with('chainId', chainId).build();
                  const owners = [
                    getAddress(faker.finance.ethereumAddress()),
                    getAddress(faker.finance.ethereumAddress()),
                  ];
                  const singleton = faker.helpers.arrayElement(
                    getSafeL2SingletonDeployments({
                      version,
                      chainId,
                    }),
                  );
                  const to = faker.helpers.arrayElement(
                    getProxyFactoryDeployments({
                      version,
                      chainId,
                    }),
                  );
                  const data = createProxyWithNonceEncoder()
                    .with('singleton', singleton)
                    .with(
                      'initializer',
                      setupEncoder().with('owners', owners).encode(),
                    )
                    .encode();
                  const taskId = faker.string.uuid();
                  networkService.get.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                        return Promise.resolve({
                          data: rawify(chain),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
                    }
                  });
                  networkService.post.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${relayUrl}/relays/v2/sponsored-call`:
                        return Promise.resolve({
                          data: rawify({ taskId }),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
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

                it('should throw when using an unofficial ProxyFactory to create an official L2 Safe', async () => {
                  const chain = chainBuilder().with('chainId', chainId).build();
                  const owners = [
                    getAddress(faker.finance.ethereumAddress()),
                    getAddress(faker.finance.ethereumAddress()),
                  ];
                  const singleton = faker.helpers.arrayElement(
                    getSafeL2SingletonDeployments({
                      version,
                      chainId,
                    }),
                  );
                  // Unofficial ProxyFactory
                  const to = getAddress(faker.finance.ethereumAddress());
                  const data = createProxyWithNonceEncoder()
                    .with('singleton', singleton)
                    .with(
                      'initializer',
                      setupEncoder().with('owners', owners).encode(),
                    )
                    .encode();
                  const taskId = faker.string.uuid();
                  networkService.get.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                        return Promise.resolve({
                          data: rawify(chain),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
                    }
                  });
                  networkService.post.mockImplementation(({ url }) => {
                    switch (url) {
                      case `${relayUrl}/relays/v2/sponsored-call`:
                        return Promise.resolve({
                          data: rawify({ taskId }),
                          status: 200,
                        });
                      default:
                        return Promise.reject(
                          `No matching rule for url: ${url}`,
                        );
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
                      message: 'Unofficial ProxyFactory contract.',
                      statusCode: 422,
                    });
                });
              }
            },
          );
        });
      });

      describe('Transaction validation', () => {
        describe('Recovery', () => {
          describe.each([
            [
              'execTransactionFromModule (Proposals)',
              execTransactionFromModuleEncoder,
            ],
            ['executeNextTx (Execution)', executeNextTxEncoder],
          ])('%s', (_, encoder) => {
            describe('Singular', () => {
              it('should return 422 when executing a non-owner management transaction', async () => {
                const chain = chainBuilder()
                  .with(
                    'chainId',
                    faker.helpers.arrayElement(supportedChainIds),
                  )
                  .build();
                const safes = faker.helpers.multiple(
                  () => getAddress(faker.finance.ethereumAddress()),
                  { count: { min: 1, max: 4 } },
                );
                const version = faker.system.semver();
                const safeAddress = faker.helpers.arrayElement(safes);
                const data = encoder()
                  .with('to', safeAddress)
                  .with(
                    'data',
                    execTransactionEncoder()
                      .with('data', execTransactionEncoder().encode())
                      .encode(),
                  )
                  .encode();
                const moduleAddress = getAddress(
                  faker.finance.ethereumAddress(),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                      return Promise.resolve({
                        data: rawify({ safes }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version,
                    to: moduleAddress,
                    data,
                  })
                  .expect(422)
                  .expect({
                    message:
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              it('should return 422 when the module is not enabled on the Safe', async () => {
                const chain = chainBuilder()
                  .with(
                    'chainId',
                    faker.helpers.arrayElement(supportedChainIds),
                  )
                  .build();
                const safes = faker.helpers.multiple(
                  () => getAddress(faker.finance.ethereumAddress()),
                  { count: { min: 1, max: 4 } },
                );
                const version = faker.system.semver();
                const safeAddress = getAddress(faker.finance.ethereumAddress()); // Not in safes
                const data = encoder()
                  .with('to', safeAddress)
                  .with(
                    'data',
                    execTransactionEncoder()
                      .with('data', addOwnerWithThresholdEncoder().encode())
                      .encode(),
                  )
                  .encode();
                const moduleAddress = getAddress(
                  faker.finance.ethereumAddress(),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                      return Promise.resolve({
                        data: rawify({ safes }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version,
                    to: moduleAddress,
                    data,
                  })
                  .expect(422)
                  .expect({
                    message:
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });
            });

            describe('Batch', () => {
              it('should return 422 when a non-owner management transaction is in a batch', async () => {
                const chain = chainBuilder()
                  .with(
                    'chainId',
                    faker.helpers.arrayElement(supportedChainIds),
                  )
                  .build();
                const safes = faker.helpers.multiple(
                  () => getAddress(faker.finance.ethereumAddress()),
                  { count: { min: 2, max: 4 } },
                );
                // We don't need to test all possible combinations as we only use the address
                // to check the officiality of the MultiSend. The rest is universal for all.
                const multiSendVersion = faker.helpers.arrayElement(
                  MULTI_SEND_VERSIONS[chain.chainId],
                );
                const [multiSendAddress] = getMultiSendDeployments({
                  chainId: chain.chainId,
                  version: multiSendVersion,
                });
                const safeAddress = faker.helpers.arrayElement(safes);
                const data = encoder()
                  .with('to', multiSendAddress)
                  .with(
                    'data',
                    multiSendEncoder()
                      .with(
                        'transactions',
                        multiSendTransactionsEncoder(
                          [
                            execTransactionEncoder()
                              .with(
                                'data',
                                addOwnerWithThresholdEncoder().encode(),
                              )
                              .encode(),
                            execTransactionEncoder()
                              // Not an owner management transaction
                              .with('data', execTransactionEncoder().encode())
                              .encode(),
                          ].map((data) => ({
                            operation: faker.number.int({ min: 0, max: 1 }),
                            data,
                            to: safeAddress,
                            value: faker.number.bigInt(),
                          })),
                        ),
                      )
                      .encode(),
                  )
                  .encode();
                const moduleAddress = getAddress(
                  faker.finance.ethereumAddress(),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                      return Promise.resolve({
                        data: rawify({ safes }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version: multiSendVersion,
                    to: moduleAddress,
                    data,
                  })
                  .expect(422)
                  .expect({
                    message:
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              it('should return 422 when the module is not enabled on a Safe in a batch', async () => {
                const chain = chainBuilder()
                  .with(
                    'chainId',
                    faker.helpers.arrayElement(supportedChainIds),
                  )
                  .build();
                const safes = faker.helpers.multiple(
                  () => getAddress(faker.finance.ethereumAddress()),
                  { count: 2 },
                );
                // We don't need to test all possible combinations as we only use the address
                // to check the officiality of the MultiSend. The rest is universal for all.
                const multiSendVersion = faker.helpers.arrayElement(
                  MULTI_SEND_VERSIONS[chain.chainId],
                );
                const [multiSendAddress] = getMultiSendDeployments({
                  chainId: chain.chainId,
                  version: multiSendVersion,
                });
                const data = encoder()
                  .with('to', multiSendAddress)
                  .with(
                    'data',
                    multiSendEncoder()
                      .with(
                        'transactions',
                        multiSendTransactionsEncoder(
                          [
                            execTransactionEncoder()
                              .with(
                                'data',
                                addOwnerWithThresholdEncoder().encode(),
                              )
                              .encode(),
                            execTransactionEncoder()
                              .with('data', changeThresholdEncoder().encode())
                              .encode(),
                          ].map((data) => ({
                            operation: faker.number.int({ min: 0, max: 1 }),
                            data,
                            // Not in safes
                            to: getAddress(faker.finance.ethereumAddress()),
                            value: faker.number.bigInt(),
                          })),
                        ),
                      )
                      .encode(),
                  )
                  .encode();
                const moduleAddress = getAddress(
                  faker.finance.ethereumAddress(),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                      return Promise.resolve({
                        data: rawify({ safes }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version: multiSendVersion,
                    to: moduleAddress,
                    data,
                  })
                  .expect(422)
                  .expect({
                    message:
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              it('should return 422 when the module is recovering more than one Safe in a batch', async () => {
                const chain = chainBuilder()
                  .with(
                    'chainId',
                    faker.helpers.arrayElement(supportedChainIds),
                  )
                  .build();
                const safes = faker.helpers.multiple(
                  () => getAddress(faker.finance.ethereumAddress()),
                  { count: { min: 2, max: 4 } },
                );
                // We don't need to test all possible combinations as we only use the address
                // to check the officiality of the MultiSend. The rest is universal for all.
                const multiSendVersion = faker.helpers.arrayElement(
                  MULTI_SEND_VERSIONS[chain.chainId],
                );
                const [multiSendAddress] = getMultiSendDeployments({
                  chainId: chain.chainId,
                  version: multiSendVersion,
                });
                const data = encoder()
                  .with('to', multiSendAddress)
                  .with(
                    'data',
                    multiSendEncoder()
                      .with(
                        'transactions',
                        multiSendTransactionsEncoder(
                          [
                            execTransactionEncoder()
                              .with(
                                'data',
                                addOwnerWithThresholdEncoder().encode(),
                              )
                              .encode(),
                            execTransactionEncoder()
                              .with('data', changeThresholdEncoder().encode())
                              .encode(),
                          ].map((data, i) => ({
                            operation: faker.number.int({ min: 0, max: 1 }),
                            data,
                            // More than one Safe
                            to: safes[i],
                            value: faker.number.bigInt(),
                          })),
                        ),
                      )
                      .encode(),
                  )
                  .encode();
                const moduleAddress = getAddress(
                  faker.finance.ethereumAddress(),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                      return Promise.resolve({
                        data: rawify({ safes }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version: multiSendVersion,
                    to: moduleAddress,
                    data,
                  })
                  .expect(422)
                  .expect({
                    message:
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              it('should return 422 when not an official MultiSend', async () => {
                const chain = chainBuilder()
                  .with(
                    'chainId',
                    faker.helpers.arrayElement(supportedChainIds),
                  )
                  .build();
                const version = faker.system.semver();
                const safes = faker.helpers.multiple(
                  () => getAddress(faker.finance.ethereumAddress()),
                  { count: { min: 1, max: 4 } },
                );
                const safeAddress = faker.helpers.arrayElement(safes);
                const data = encoder()
                  // to is not a MultiSend
                  .with(
                    'data',
                    multiSendEncoder()
                      .with(
                        'transactions',
                        multiSendTransactionsEncoder(
                          [
                            execTransactionEncoder()
                              .with(
                                'data',
                                addOwnerWithThresholdEncoder().encode(),
                              )
                              .encode(),
                            execTransactionEncoder()
                              .with('data', changeThresholdEncoder().encode())
                              .encode(),
                          ].map((data) => ({
                            operation: faker.number.int({ min: 0, max: 1 }),
                            data,
                            to: safeAddress,
                            value: faker.number.bigInt(),
                          })),
                        ),
                      )
                      .encode(),
                  )
                  .encode();
                const moduleAddress = getAddress(
                  faker.finance.ethereumAddress(),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                      return Promise.resolve({
                        data: rawify({ safes }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });

                await request(app.getHttpServer())
                  .post(`/v1/chains/${chain.chainId}/relay`)
                  .send({
                    version,
                    to: moduleAddress,
                    data,
                  })
                  .expect(422)
                  .expect({
                    message:
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });
            });
          });
        });

        describe('Safe', () => {
          describe.each(SAFE_VERSIONS[chainId])(
            'v%s execTransaction',
            (version) => {
              // execTransaction
              it('should return 422 when sending native currency to self', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const data = execTransactionEncoder()
                  .with('to', safeAddress)
                  .with('value', faker.number.bigInt())
                  .encode();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              // transfer (execTransaction)
              it('should return 422 `transfer`ing ERC-20 tokens to self', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const data = execTransactionEncoder()
                  .with(
                    'data',
                    erc20TransferEncoder().with('to', safeAddress).encode(),
                  )
                  .encode();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              // transferFrom (execTransaction)
              it('should return 422 `transferFrom`ing ERC-20 tokens to self', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const data = execTransactionEncoder()
                  .with(
                    'data',
                    erc20TransferFromEncoder()
                      .with('recipient', safeAddress)
                      .encode(),
                  )
                  .encode();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              it('should return 422 `transferFrom`ing ERC-20 tokens from sender to sender as recipient', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const recipient = getAddress(faker.finance.ethereumAddress());
                const data = execTransactionEncoder()
                  .with(
                    'data',
                    erc20TransferFromEncoder()
                      .with('sender', recipient)
                      .with('recipient', recipient)
                      .encode(),
                  )
                  .encode();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              // approve (execTransaction)
              it('should return 422 when trying to call an ERC-20 method on the Safe', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safe = safeBuilder().build();
                const safeAddress = getAddress(safe.address);
                const data = execTransactionEncoder()
                  .with('to', safeAddress)
                  .with('data', erc20ApproveEncoder().encode())
                  .encode();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });

              // Unofficial mastercopy
              it('should return 422 when the mastercopy is not official', async () => {
                const chain = chainBuilder().with('chainId', chainId).build();
                const safeAddress = faker.finance.ethereumAddress();
                const data = execTransactionEncoder()
                  .with('value', faker.number.bigInt())
                  .encode();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Unofficial mastercopy
                      return Promise.reject(new Error('Not found'));
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
            },
          );
        });

        describe('MultiSendCallOnly', () => {
          describe.each(MULTI_SEND_CALL_ONLY_VERSIONS[chainId])(
            'v%s multiSend',
            (version) => {
              it('should return 422 when the batch has an invalid transaction', async () => {
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
                const to = faker.helpers.arrayElement(
                  getMultiSendCallOnlyDeployments({
                    version,
                    chainId,
                  }),
                );
                const taskId = faker.string.uuid();
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
                  }
                });
                networkService.post.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${relayUrl}/relays/v2/sponsored-call`:
                      return Promise.resolve({
                        data: rawify({ taskId }),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                const to = faker.helpers.arrayElement(
                  getMultiSendCallOnlyDeployments({
                    version,
                    chainId,
                  }),
                );
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Unofficial mastercopy
                      return Promise.reject(new Error('Not found'));
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                const to = faker.helpers.arrayElement(
                  getMultiSendCallOnlyDeployments({
                    version,
                    chainId,
                  }),
                );
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Unofficial mastercopy
                      return Promise.reject(new Error('Not found'));
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                      // Official mastercopy
                      return Promise.resolve({
                        data: rawify(safe),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
          describe.each(PROXY_FACTORY_VERSIONS[chainId])(
            'v%s createProxyWithNonce',
            (version) => {
              it('should return 422 creating an unofficial Safe', async () => {
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
                networkService.get.mockImplementation(({ url }) => {
                  switch (url) {
                    case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                      return Promise.resolve({
                        data: rawify(chain),
                        status: 200,
                      });
                    default:
                      return Promise.reject(`No matching rule for url: ${url}`);
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
                      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
                    statusCode: 422,
                  });
              });
            },
          );
        });

        it('should return 422 if the gasLimit is invalid', async () => {
          // Version supported by all contracts
          const version = '1.3.0';
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('value', faker.number.bigInt())
            .encode();
          const gasLimit = 'invalid';

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              version,
              to: safeAddress,
              data,
              gasLimit,
            })
            .expect(422)
            .expect({
              statusCode: 422,
              code: 'custom',
              path: ['gasLimit'],
              message: 'Unable to parse value',
            });
        });

        it('should otherwise return 422', async () => {
          // Version supported by all contracts
          const version = '1.3.0';
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = erc20TransferEncoder().encode();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: rawify(safe), status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
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
                'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
              statusCode: 422,
            });
        });
      });

      describe('Rate limiting', () => {
        describe('Recovery', () => {
          describe.each([
            [
              'execTransactionFromModule (Proposals)',
              execTransactionFromModuleEncoder,
            ],
            ['executeNextTx (Execution)', executeNextTxEncoder],
          ])('%s', (_, encoder) => {
            it('should increment the rate limit counter with singular recovery calls', async () => {
              const chain = chainBuilder()
                .with('chainId', faker.helpers.arrayElement(supportedChainIds))
                .build();
              const safes = faker.helpers.multiple(
                () => getAddress(faker.finance.ethereumAddress()),
                { count: { min: 1, max: 4 } },
              );
              const version = faker.system.semver();
              const safeAddress = faker.helpers.arrayElement(safes);
              const data = encoder()
                .with('to', safeAddress)
                .with(
                  'data',
                  execTransactionEncoder()
                    .with('data', addOwnerWithThresholdEncoder().encode())
                    .encode(),
                )
                .encode();
              const moduleAddress = getAddress(faker.finance.ethereumAddress());
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                    return Promise.resolve({
                      data: rawify({ safes }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version,
                  to: moduleAddress,
                  data,
                })
                .expect(201)
                .expect({
                  taskId,
                });

              await request(app.getHttpServer())
                .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
                .expect(({ body }) => {
                  expect(body).toMatchObject({
                    remaining: 4,
                  });
                });
            });

            it('should increment the rate limit counter with batch recovery calls', async () => {
              const chain = chainBuilder()
                .with('chainId', faker.helpers.arrayElement(supportedChainIds))
                .build();
              const safes = faker.helpers.multiple(
                () => getAddress(faker.finance.ethereumAddress()),
                { count: { min: 2, max: 4 } },
              );
              // We don't need to test all possible combinations as we only use the address
              // to check the officiality of the MultiSend. The rest is universal for all.
              const multiSendVersion = faker.helpers.arrayElement(
                MULTI_SEND_VERSIONS[chain.chainId],
              );
              const [multiSendAddress] = getMultiSendDeployments({
                chainId: chain.chainId,
                version: multiSendVersion,
              });
              const safeAddress = faker.helpers.arrayElement(safes);
              const data = encoder()
                .with('to', multiSendAddress)
                .with(
                  'data',
                  multiSendEncoder()
                    .with(
                      'transactions',
                      multiSendTransactionsEncoder(
                        [
                          execTransactionEncoder()
                            .with(
                              'data',
                              addOwnerWithThresholdEncoder().encode(),
                            )
                            .encode(),
                          execTransactionEncoder()
                            .with('data', changeThresholdEncoder().encode())
                            .encode(),
                        ].map((data) => ({
                          operation: faker.number.int({ min: 0, max: 1 }),
                          data,
                          to: safeAddress,
                          value: faker.number.bigInt(),
                        })),
                      ),
                    )
                    .encode(),
                )
                .encode();
              const moduleAddress = getAddress(faker.finance.ethereumAddress());
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  case `${chain.transactionService}/api/v1/modules/${moduleAddress}/safes/`:
                    return Promise.resolve({
                      data: rawify({ safes }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });

              await request(app.getHttpServer())
                .post(`/v1/chains/${chain.chainId}/relay`)
                .send({
                  version: multiSendVersion,
                  to: moduleAddress,
                  data,
                })
                .expect(201)
                .expect({
                  taskId,
                });

              await request(app.getHttpServer())
                .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
                .expect(({ body }) => {
                  expect(body).toMatchObject({
                    remaining: 4,
                  });
                });
            });
          });
        });

        describe('Safe', () => {
          it.each(SAFE_VERSIONS[chainId])(
            'should increment the rate limit counter of v%s execTransaction calls',
            async (version) => {
              const chain = chainBuilder().with('chainId', chainId).build();
              const safe = safeBuilder().build();
              const safeAddress = getAddress(safe.address);
              const data = execTransactionEncoder()
                .with('value', faker.number.bigInt())
                .encode();
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                    // Official mastercopy
                    return Promise.resolve({ data: rawify(safe), status: 200 });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
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
          it.each(MULTI_SEND_CALL_ONLY_VERSIONS[chainId])(
            'should increment the rate limit counter of v%s multiSend calls',
            async (version) => {
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
              const to = faker.helpers.arrayElement(
                getMultiSendCallOnlyDeployments({
                  version,
                  chainId,
                }),
              );
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                    // Official mastercopy
                    return Promise.resolve({ data: rawify(safe), status: 200 });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
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
          it.each(PROXY_FACTORY_VERSIONS[chainId])(
            'should increment the rate limit counter of the owners of a v%s createProxyWithNonce call',
            async (version) => {
              const chain = chainBuilder().with('chainId', chainId).build();

              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = faker.helpers.arrayElement(
                getSafeSingletonDeployments({
                  version,
                  chainId,
                }),
              );
              const to = faker.helpers.arrayElement(
                getProxyFactoryDeployments({
                  version,
                  chainId,
                }),
              );
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              const taskId = faker.string.uuid();
              networkService.get.mockImplementation(({ url }) => {
                switch (url) {
                  case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                    return Promise.resolve({
                      data: rawify(chain),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
                }
              });
              networkService.post.mockImplementation(({ url }) => {
                switch (url) {
                  case `${relayUrl}/relays/v2/sponsored-call`:
                    return Promise.resolve({
                      data: rawify({ taskId }),
                      status: 200,
                    });
                  default:
                    return Promise.reject(`No matching rule for url: ${url}`);
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
          // Version supported by all contracts
          const version = '1.3.0';
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const nonChecksummedAddress = safe.address.toLowerCase();
          const checksummedSafeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('value', faker.number.bigInt())
            .encode();
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${chain.transactionService}/api/v1/safes/${nonChecksummedAddress}`:
              case `${chain.transactionService}/api/v1/safes/${checksummedSafeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: rawify(safe), status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({
                  data: rawify({ taskId }),
                  status: 200,
                });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          for (const address of [
            nonChecksummedAddress,
            checksummedSafeAddress,
          ]) {
            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                to: address,
                data,
                version,
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
          const differentChainId = faker.string.numeric({ exclude: chainId });
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('value', faker.number.bigInt())
            .encode();
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: rawify(safe), status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({
                  data: rawify({ taskId }),
                  status: 200,
                });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
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
          // Version supported by all contracts
          const version = '1.3.0';
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('value', faker.number.bigInt())
            .encode();
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: rawify(chain), status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: rawify(safe), status: 200 });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({
                  data: rawify({ taskId }),
                  status: 200,
                });
              default:
                return Promise.reject(`No matching rule for url: ${url}`);
            }
          });

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for (const _ of Array.from({ length: 5 })) {
            await request(app.getHttpServer())
              .post(`/v1/chains/${chain.chainId}/relay`)
              .send({
                to: safeAddress,
                data,
                version,
              });
          }

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
              version,
            })
            .expect(429)
            .expect({
              message: `Relay limit reached for ${safeAddress}`,
              statusCode: 429,
            });
        });
      });

      it('should return 503 if the relayer throws', async () => {
        // Version supported by all contracts
        const version = '1.3.0';
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const data = execTransactionEncoder().encode();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safe.address}`:
              // Official mastercopy
              return Promise.resolve({ data: rawify(safe), status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.reject(new Error('Relayer error'));
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safe.address,
            data,
            version,
          })
          .expect(503);
      });
    });

    describe('GET /v1/chains/:chainId/relay/:safeAddress', () => {
      it('should return the limit and remaining relay attempts', async () => {
        const safeAddress = faker.finance.ethereumAddress();
        await request(app.getHttpServer())
          .get(`/v1/chains/${chainId}/relay/${safeAddress}`)
          .expect(200)
          .expect({ remaining: 5, limit: 5 });
      });

      it('should not return negative limits if more requests were made than the limit', async () => {
        // Version supported by all contracts
        const version = '1.3.0';
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode();
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation(({ url }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: rawify(chain), status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: rawify(safe), status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });
        networkService.post.mockImplementation(({ url }) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: rawify({ taskId }), status: 200 });
            default:
              return Promise.reject(`No matching rule for url: ${url}`);
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _ of Array.from({ length: 6 })) {
          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
              version,
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
  });
});
