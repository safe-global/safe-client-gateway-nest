import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { chainUpdateEventBuilder } from '@/routes/hooks/entities/__tests__/chain-update.builder';
import { safeAppsEventBuilder } from '@/routes/hooks/entities/__tests__/safe-apps-update.builder';
import { outgoingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-ether.builder';
import { outgoingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-token.builder';
import { newConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-confirmation.builder';
import { safeCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/safe-created.build';
import { deletedMultisigTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/executed-transaction.builder';
import { moduleTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/module-transaction.builder';
import { incomingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-token.builder';
import { newMessageConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-message-confirmation.builder';
import request from 'supertest';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { TestPushNotificationsApiModule } from '@/datasources/push-notifications-api/__tests__/test.push-notifications-api.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { pendingTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/pending-transaction.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import { messageCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/message-created.builder';
import { messageConfirmationBuilder } from '@/domain/messages/entities/__tests__/message-confirmation.builder';
import type { UUID } from 'crypto';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';

// TODO: Migrate to E2E tests as TransactionEventType events are already being received via queue.
describe.skip('Post Hook Events for Notifications (Unit)', () => {
  let app: INestApplication<Server>;
  let pushNotificationsApi: jest.MockedObjectDeep<IPushNotificationsApi>;
  let notificationsRepository: jest.MockedObjectDeep<INotificationsRepositoryV2>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let authToken: string;
  let safeConfigUrl: string;

  const defaultConfiguration = configuration();
  const testConfiguration = (): ReturnType<typeof configuration> => {
    return {
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        pushNotifications: true,
      },
    };
  };

  async function initApp(): Promise<void> {
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
      .overrideModule(PushNotificationsApiModule)
      .useModule(TestPushNotificationsApiModule)
      .overrideModule(NotificationsRepositoryV2Module)
      .useModule(TestNotificationsRepositoryV2Module)
      .compile();
    app = moduleFixture.createNestApplication();

    networkService = moduleFixture.get(NetworkService);
    pushNotificationsApi = moduleFixture.get(IPushNotificationsApi);
    configurationService = moduleFixture.get(IConfigurationService);
    authToken = configurationService.getOrThrow('auth.token');
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');

    notificationsRepository = moduleFixture.get(INotificationsRepositoryV2);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(
    [
      chainUpdateEventBuilder().build(),
      safeAppsEventBuilder().build(),
      outgoingEtherEventBuilder().build(),
      outgoingTokenEventBuilder().build(),
      newConfirmationEventBuilder().build(),
      newMessageConfirmationEventBuilder().build(),
      safeCreatedEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should not enqueue notifications for %s events', async (_, event) => {
    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
  });

  it.each(
    [
      deletedMultisigTransactionEventBuilder().build(),
      executedTransactionEventBuilder().build(),
      moduleTransactionEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('should enqueue %s event notifications as is', async (_, event) => {
    const subscribers = faker.helpers.multiple(
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
      {
        count: { min: 1, max: 5 },
      },
    );
    const chain = chainBuilder().build();
    notificationsRepository.getSubscribersBySafe.mockResolvedValue(subscribers);
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
      subscribers.length,
    );
    subscribers.forEach((subscriber, i) => {
      expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
        i + 1,
        subscriber.cloudMessagingToken,
        { data: event },
      );
    });
  });
  it.each(
    [
      incomingEtherEventBuilder().build(),
      incomingTokenEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )(
    'should enqueue %s event notifications when receiving assets from other parties',
    async (_, event) => {
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/safes/${event.address}/incoming-transfers/`
        ) {
          const transfers = [
            nativeTokenTransferBuilder()
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc721TransferBuilder()
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc20TransferBuilder()
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
          ];
          return Promise.resolve({
            status: 200,
            data: rawify(
              pageBuilder()
                .with('results', [faker.helpers.arrayElement(transfers)])
                .build(),
            ),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          pushNotificationsApi.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, subscriber.cloudMessagingToken, {
          data: event,
        });
      });
    },
  );

  it.each(
    [
      incomingEtherEventBuilder().build(),
      incomingTokenEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )(
    'should not enqueue %s event notifications when receiving assets from the Safe itself',
    async (_, event) => {
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/safes/${event.address}/incoming-transfers/`
        ) {
          const transfers = [
            nativeTokenTransferBuilder()
              .with('from', event.address)
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc721TransferBuilder()
              .with('from', event.address)
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
            erc20TransferBuilder()
              .with('from', event.address)
              .with('to', event.address)
              .with('transactionHash', event.txHash as `0x${string}`)
              .build(),
          ];
          return Promise.resolve({
            status: 200,
            data: rawify(
              pageBuilder()
                .with('results', [faker.helpers.arrayElement(transfers)])
                .build(),
            ),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    },
  );

  describe('owners', () => {
    it("should enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the owner hasn't yet signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          pushNotificationsApi.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, subscriber.cloudMessagingToken, {
          data: {
            ...event,
            type: 'CONFIRMATION_REQUEST',
          },
        });
      });
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold of 1', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 but the owner has signed', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const multisigTransaction = multisigTransactionBuilder()
        .with(
          'confirmations',
          subscribers.map((subscriber) => {
            return confirmationBuilder()
              .with('owner', subscriber.subscriber)
              .build();
          }),
        )
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it("should only enqueue PENDING_MULTISIG_TRANSACTION event notifications for those that haven't signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const confirmations = faker.helpers
        .arrayElements(owners, { min: 1, max: owners.length - 1 })
        .map((owner) => {
          return confirmationBuilder().with('owner', owner).build();
        });
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(pushNotificationsApi.enqueueNotification.mock.calls).toStrictEqual(
        expect.arrayContaining(
          subscribers
            .filter((subscriber) => {
              return confirmations.every((confirmation) => {
                return confirmation.owner !== subscriber.subscriber;
              });
            })
            .map((subscriber) => [
              subscriber.cloudMessagingToken,
              {
                data: {
                  ...event,
                  type: 'CONFIRMATION_REQUEST',
                },
              },
            ]),
        ),
      );
    });

    it("should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the owner hasn't yet signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          pushNotificationsApi.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, subscriber.cloudMessagingToken, {
          data: {
            ...event,
            type: 'MESSAGE_CONFIRMATION_REQUEST',
          },
        });
      });
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold of 1', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 but the owner has signed', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with(
          'owners',
          subscribers.map((subscriber) => subscriber.subscriber),
        )
        .build();
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .with(
          'confirmations',
          subscribers.map((subscriber) => {
            return messageConfirmationBuilder()
              .with('owner', subscriber.subscriber)
              .build();
          }),
        )
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it("should only enqueue MESSAGE_CONFIRMATION_REQUEST event notifications for those that haven't signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const confirmations = faker.helpers
        .arrayElements(owners, { min: 1, max: owners.length - 1 })
        .map((owner) => {
          return messageConfirmationBuilder().with('owner', owner).build();
        });
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(pushNotificationsApi.enqueueNotification.mock.calls).toStrictEqual(
        expect.arrayContaining(
          subscribers
            .filter((subscriber) => {
              return confirmations.every((confirmation) => {
                return confirmation.owner !== subscriber.subscriber;
              });
            })
            .map((subscriber) => [
              subscriber.cloudMessagingToken,
              {
                data: {
                  ...event,
                  type: 'MESSAGE_CONFIRMATION_REQUEST',
                },
              },
            ]),
        ),
      );
    });
  });

  // Note: many of the following are edge cases that can likely never or are highly unlikely to happen in practice
  // but we keep them here for completeness and to ensure the code behaves correctly in all scenarios
  describe('delegates', () => {
    it("should enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the delegate hasn't yet signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          pushNotificationsApi.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, subscriber.cloudMessagingToken, {
          data: {
            ...event,
            type: 'CONFIRMATION_REQUEST',
          },
        });
      });
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold of 1', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it('should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 but the delegate has signed', async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      const multisigTransaction = multisigTransactionBuilder()
        .with(
          'confirmations',
          subscribers.map((subscriber) => {
            return confirmationBuilder()
              .with('owner', subscriber.subscriber)
              .build();
          }),
        )
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it("should only enqueue PENDING_MULTISIG_TRANSACTION event notifications for those that haven't signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      const confirmations = faker.helpers
        .arrayElements(owners, { min: 1, max: owners.length - 1 })
        .map((owner) => {
          return confirmationBuilder().with('owner', owner).build();
        });
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(pushNotificationsApi.enqueueNotification.mock.calls).toStrictEqual(
        expect.arrayContaining(
          subscribers
            .filter((subscriber) => {
              return confirmations.every((confirmation) => {
                return confirmation.owner !== subscriber.subscriber;
              });
            })
            .map((subscriber) => [
              subscriber.cloudMessagingToken,
              {
                data: {
                  ...event,
                  type: 'CONFIRMATION_REQUEST',
                },
              },
            ]),
        ),
      );
    });

    it("should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the delegate hasn't yet signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length,
      );
      subscribers.forEach((subscriber, i) => {
        expect(
          pushNotificationsApi.enqueueNotification,
        ).toHaveBeenNthCalledWith(i + 1, subscriber.cloudMessagingToken, {
          data: {
            ...event,
            type: 'MESSAGE_CONFIRMATION_REQUEST',
          },
        });
      });
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold of 1', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', 1)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it('should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 but the delegate has signed', async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: getAddress(faker.finance.ethereumAddress()),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .with(
          'confirmations',
          subscribers.map((subscriber) => {
            return messageConfirmationBuilder()
              .with('owner', subscriber.subscriber)
              .build();
          }),
        )
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it("should only enqueue MESSAGE_CONFIRMATION_REQUEST event notifications for those that haven't signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .with('owners', owners)
        .build();
      const subscribers = owners.map((owner) => ({
        subscriber: owner,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }));
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );
      const delegates = subscribers.map((subscriber) => {
        return delegateBuilder()
          .with('delegate', subscriber.subscriber)
          .with('safe', event.address)
          .build();
      });
      const confirmations = faker.helpers
        .arrayElements(owners, { min: 1, max: owners.length - 1 })
        .map((owner) => {
          return messageConfirmationBuilder().with('owner', owner).build();
        });
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .with('confirmations', confirmations)
        .build();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', delegates).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
        subscribers.length - confirmations.length,
      );
      expect(pushNotificationsApi.enqueueNotification.mock.calls).toStrictEqual(
        expect.arrayContaining(
          subscribers
            .filter((subscriber) => {
              return confirmations.every((confirmation) => {
                return confirmation.owner !== subscriber.subscriber;
              });
            })
            .map((subscriber) => [
              subscriber.cloudMessagingToken,
              {
                data: {
                  ...event,
                  type: 'MESSAGE_CONFIRMATION_REQUEST',
                },
              },
            ]),
        ),
      );
    });
  });

  describe('non-owners/delegates', () => {
    it("should not enqueue PENDING_MULTISIG_TRANSACTION event notifications if the Safe has a threshold > 1 and the subscriber hasn't yet signed", async () => {
      const event = pendingTransactionEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const multisigTransaction = multisigTransactionBuilder()
        .with('safe', event.address)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', []).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(multisigTransaction),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });

    it("should not enqueue MESSAGE_CONFIRMATION_REQUEST event notifications if the Safe has a threshold > 1 and the subscriber hasn't yet signed", async () => {
      const event = messageCreatedEventBuilder().build();
      const chain = chainBuilder().with('chainId', event.chainId).build();
      const safe = safeBuilder()
        .with('address', event.address)
        .with('threshold', faker.number.int({ min: 2 }))
        .build();
      const message = messageBuilder()
        .with('messageHash', event.messageHash as `0x${string}`)
        .build();
      const subscribers = faker.helpers.multiple(
        () => ({
          subscriber: faker.helpers.arrayElement([
            getAddress(faker.finance.ethereumAddress()),
            null,
          ]),
          deviceUuid: faker.string.uuid() as UUID,
          cloudMessagingToken: faker.string.alphanumeric(),
        }),
        {
          count: { min: 1, max: 5 },
        },
      );
      notificationsRepository.getSubscribersBySafe.mockResolvedValue(
        subscribers,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        } else if (
          url === `${chain.transactionService}/api/v1/safes/${event.address}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(safe),
          });
        } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({
            status: 200,
            data: rawify(pageBuilder().with('results', []).build()),
          });
        } else if (
          url ===
          `${chain.transactionService}/api/v1/messages/${event.messageHash}`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify(message),
          });
        } else {
          return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        .expect(202);

      expect(pushNotificationsApi.enqueueNotification).not.toHaveBeenCalled();
    });
  });

  it('should enqueue CONFIRMATION_REQUEST event notifications accordingly for a mixture of subscribers: owners, delegates and non-owner/delegates', async () => {
    const event = pendingTransactionEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const ownerSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
    ];
    const delegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
    ];
    const nonOwnerDelegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
      {
        subscriber: null,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
    ];
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', 2)
      .with(
        'owners',
        ownerSubscriptions.map((subscription) => subscription.subscriber),
      )
      .build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', event.address)
      .with('confirmations', [
        confirmationBuilder()
          .with('owner', ownerSubscriptions[0].subscriber)
          .build(),
      ])
      .build();
    notificationsRepository.getSubscribersBySafe.mockResolvedValue([
      ...ownerSubscriptions,
      ...delegateSubscriptions,
      ...nonOwnerDelegateSubscriptions,
    ]);

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(safe),
        });
      } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
        return Promise.resolve({
          status: 200,
          data: rawify(
            pageBuilder()
              .with(
                'results',
                delegateSubscriptions.map((subscription) => {
                  return delegateBuilder()
                    .with('delegate', subscription.subscriber)
                    .with('safe', safe.address)
                    .build();
                }),
              )
              .build(),
          ),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${event.safeTxHash}/`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(multisigTransaction),
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(3);
    expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
      1,
      ownerSubscriptions[1].cloudMessagingToken,
      {
        data: {
          ...event,
          type: 'CONFIRMATION_REQUEST',
        },
      },
    );
    expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
      2,
      delegateSubscriptions[0].cloudMessagingToken,
      {
        data: {
          ...event,
          type: 'CONFIRMATION_REQUEST',
        },
      },
    );
    expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
      3,
      delegateSubscriptions[1].cloudMessagingToken,
      {
        data: {
          ...event,
          type: 'CONFIRMATION_REQUEST',
        },
      },
    );
  });

  it('should enqueue MESSAGE_CONFIRMATION_REQUEST event notifications accordingly for a mixture of subscribers: owners, delegates and non-owner/delegates', async () => {
    const event = messageCreatedEventBuilder().build();
    const chain = chainBuilder().with('chainId', event.chainId).build();
    const ownerSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
    ];
    const delegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
    ];
    const nonOwnerDelegateSubscriptions = [
      {
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
      {
        subscriber: null,
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      },
    ];
    const safe = safeBuilder()
      .with('address', event.address)
      .with('threshold', 2)
      .with(
        'owners',
        ownerSubscriptions.map((subscription) => subscription.subscriber),
      )
      .build();
    const message = messageBuilder()
      .with('messageHash', event.messageHash as `0x${string}`)
      .with('confirmations', [
        messageConfirmationBuilder()
          .with('owner', ownerSubscriptions[0].subscriber)
          .build(),
      ])
      .build();
    notificationsRepository.getSubscribersBySafe.mockResolvedValue([
      ...ownerSubscriptions,
      ...delegateSubscriptions,
      ...nonOwnerDelegateSubscriptions,
    ]);

    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${event.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(safe),
        });
      } else if (url === `${chain.transactionService}/api/v2/delegates/`) {
        return Promise.resolve({
          status: 200,
          data: rawify(
            pageBuilder()
              .with(
                'results',
                delegateSubscriptions.map((subscription) => {
                  return delegateBuilder()
                    .with('delegate', subscription.subscriber)
                    .with('safe', safe.address)
                    .build();
                }),
              )
              .build(),
          ),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/messages/${event.messageHash}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(message),
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(3);
    expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
      1,
      ownerSubscriptions[1].cloudMessagingToken,
      {
        data: {
          ...event,
          type: 'MESSAGE_CONFIRMATION_REQUEST',
        },
      },
    );
    expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
      2,
      delegateSubscriptions[0].cloudMessagingToken,
      {
        data: {
          ...event,
          type: 'MESSAGE_CONFIRMATION_REQUEST',
        },
      },
    );
    expect(pushNotificationsApi.enqueueNotification).toHaveBeenNthCalledWith(
      3,
      delegateSubscriptions[1].cloudMessagingToken,
      {
        data: {
          ...event,
          type: 'MESSAGE_CONFIRMATION_REQUEST',
        },
      },
    );
  });

  it('should cleanup unregistered tokens', async () => {
    // Events that are notified "as is" for simplicity
    const event = faker.helpers.arrayElement([
      deletedMultisigTransactionEventBuilder().build(),
      executedTransactionEventBuilder().build(),
      moduleTransactionEventBuilder().build(),
    ]);
    const subscribers = faker.helpers.multiple(
      () => ({
        subscriber: getAddress(faker.finance.ethereumAddress()),
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
      {
        count: { min: 2, max: 5 },
      },
    );
    const chain = chainBuilder().build();
    notificationsRepository.getSubscribersBySafe.mockResolvedValue(subscribers);
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${event.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    pushNotificationsApi.enqueueNotification
      // Specific error regarding unregistered/stale tokens
      // @see https://firebase.google.com/docs/cloud-messaging/send-message#rest
      .mockRejectedValueOnce({
        code: 404,
        message: faker.lorem.words(),
        status: 'UNREGISTERED',
        details: [],
      })
      .mockResolvedValue();

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(event)
      .expect(202);

    expect(notificationsRepository.deleteDevice).toHaveBeenCalledTimes(1);
    expect(notificationsRepository.deleteDevice).toHaveBeenNthCalledWith(
      1,
      subscribers[0].deviceUuid,
    );
  });

  it('should not fail to send all notifications if one throws', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().with('threshold', 2).build();
    const deletedTransactionEvent = deletedMultisigTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const executedTransactionEvent = executedTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const incomingEtherEvent = incomingEtherEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const incomingTokenEvent = incomingTokenEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const moduleTransactionEvent = moduleTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const message = messageBuilder().with('safe', safe.address).build();
    const messageCreatedEvent = messageCreatedEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .with('messageHash', message.messageHash)
      .build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const pendingTransactionEvent = pendingTransactionEventBuilder()
      .with('address', safe.address)
      .with('chainId', chain.chainId)
      .with('safeTxHash', multisigTransaction.safeTxHash)
      .build();
    const events = [
      deletedTransactionEvent,
      executedTransactionEvent,
      incomingEtherEvent,
      incomingTokenEvent,
      moduleTransactionEvent,
      messageCreatedEvent,
      pendingTransactionEvent,
    ];
    const subscribers = faker.helpers.multiple(
      (_, i) => ({
        subscriber: safe.owners[i],
        deviceUuid: faker.string.uuid() as UUID,
        cloudMessagingToken: faker.string.alphanumeric(),
      }),
      {
        count: safe.owners.length,
      },
    );
    notificationsRepository.getSubscribersBySafe.mockResolvedValue(subscribers);
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({
          data: rawify(chain),
          status: 200,
        });
      } else if (
        url === `${chain.transactionService}/api/v1/safes/${safe.address}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(safe),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(multisigTransaction),
        });
      } else if (
        url ===
        `${chain.transactionService}/api/v1/messages/${message.messageHash}`
      ) {
        return Promise.resolve({
          status: 200,
          data: rawify(message),
        });
      } else {
        return Promise.reject(`No matching rule for url: ${url}`);
      }
    });
    pushNotificationsApi.enqueueNotification
      .mockRejectedValueOnce(new Error('Error enqueueing notification'))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Other error'))
      .mockResolvedValue();

    for (const event of events) {
      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(event)
        // Doesn't throw
        .expect(202);
    }

    expect(pushNotificationsApi.enqueueNotification).toHaveBeenCalledTimes(
      events.length,
    );
  });
});
