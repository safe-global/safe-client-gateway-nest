import { type ILoggingService } from '@/logging/logging.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository';
import type { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import type { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { upsertSubscriptionsDtoBuilder } from '@/routes/notifications/v2/entities/__tests__/upsert-subscriptions.dto.builder';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity.db';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { DataSource, In, type EntityManager } from 'typeorm';
import { postgresConfig } from '@/config/entities/postgres.config';
import configuration from '@/config/entities/__tests__/configuration';
import { NotificationSubscriptionNotificationType } from '@/datasources/notifications/entities/notification-subscription-notification-type.entity.db';
import type { UUID } from 'crypto';
import { faker } from '@faker-js/faker/.';
import { notificationDeviceBuilder } from '@/datasources/notifications/entities/__tests__/notification-devices.entity.db.builder';
import { NotificationType as NotificationTypeEnum } from '@/domain/notifications/v2/entities/notification.entity';
import { DatabaseMigrator } from '@/datasources/db/v2/database-migrator.service';
import type { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsRepositoryV2', () => {
  const mockLoggingService = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;
  const mockPushNotificationsApi: IPushNotificationsApi = {
    enqueueNotification: jest.fn(),
  };
  const mockConfigService = {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key === 'db.migrator.numberOfRetries') {
        return config.db.migrator.numberOfRetries;
      }
      if (key === 'db.migrator.retryAfterMs') {
        return config.db.migrator.retryAfterMs;
      }
    }),
  } as jest.MockedObjectDeep<ConfigService>;

  const config = configuration();
  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
  const dataSource = new DataSource({
    ...postgresConfig({
      ...config.db.connection.postgres,
      type: 'postgres',
      database: testDatabaseName,
    }),
    migrationsTableName: config.db.orm.migrationsTableName,
    entities: [
      NotificationType,
      NotificationSubscription,
      NotificationDevice,
      NotificationSubscriptionNotificationType,
    ],
  });
  let postgresDatabaseService: PostgresDatabaseService;
  let notificationsRepositoryService: INotificationsRepositoryV2;

  /**
   * Creates a new database specifically for testing purposes.
   *
   * TypeORM requires a database name to initialize a datasource.
   * To create a new test database, this function first connects
   * to the default `postgres` database, allowing the new database
   * to be created for test use.
   *
   * @async
   * @function createTestDatabase
   * @returns {Promise<void>} Resolves when migrations are complete.
   */
  async function createTestDatabase(): Promise<void> {
    const testDataSource = new DataSource({
      ...postgresConfig({
        ...config.db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });
    const testPostgresDatabaseService = new PostgresDatabaseService(
      mockLoggingService,
      testDataSource,
    );
    await testPostgresDatabaseService.initializeDatabaseConnection();
    await testPostgresDatabaseService
      .getDataSource()
      .query(`CREATE DATABASE ${testDatabaseName}`);
    await testPostgresDatabaseService.destroyDatabaseConnection();
  }

  /**
   * Initializes the test database connection
   *
   * @async
   * @function createDatabaseConnection
   * @returns {Promise<PostgresDatabaseService>} Returns an instance of PostgresDatabaseService
   */
  async function createDatabaseConnection(): Promise<PostgresDatabaseService> {
    const databaseService = new PostgresDatabaseService(
      mockLoggingService,
      dataSource,
    );
    await databaseService.initializeDatabaseConnection();

    return databaseService;
  }

  /**
   * Runs database migrations for the test or application database.
   *
   * This function initializes a `DatabaseMigrator` instance with the necessary
   * services (logging, database, and configuration) and executes the migration
   * process.
   *
   * @param {postgresDatabaseService} postgresDatabaseService The postgres database service instance
   *
   * @async
   * @function migrateDatabase
   * @returns {Promise<void>} Resolves when migrations are complete.
   */
  async function migrateDatabase(
    postgresDatabaseService: PostgresDatabaseService,
  ): Promise<void> {
    const migrator = new DatabaseMigrator(
      mockLoggingService,
      postgresDatabaseService,
      mockConfigService,
    );
    await migrator.migrate();
  }

  /**
   * Truncates data in specific tables used for notifications.
   *
   * This function deletes all rows from the `NotificationSubscription`,
   * `NotificationDevice`, and `NotificationSubscriptionNotificationType` tables.
   * It uses query builders to perform the deletions without conditions,
   * effectively clearing all records for test or reset purposes.
   *
   * @async
   * @function truncateTables
   * @returns {Promise<void>} Resolves when all specified tables are truncated.
   */
  async function truncateTables(): Promise<void> {
    const subscriptionRepository = dataSource.getRepository(
      NotificationSubscription,
    );
    const notificationDeviceRepository =
      dataSource.getRepository(NotificationDevice);
    const notificationSubscriptionNotificationTypeRepository =
      dataSource.getRepository(NotificationSubscriptionNotificationType);

    await notificationDeviceRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();

    await subscriptionRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();

    await notificationSubscriptionNotificationTypeRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
  }

  beforeAll(async () => {
    await createTestDatabase();
    postgresDatabaseService = await createDatabaseConnection();
    await migrateDatabase(postgresDatabaseService);

    notificationsRepositoryService = new NotificationsRepositoryV2(
      mockPushNotificationsApi,
      mockLoggingService,
      postgresDatabaseService,
    );
  });

  afterAll(async () => {
    await postgresDatabaseService.getDataSource().dropDatabase();
    await postgresDatabaseService.destroyDatabaseConnection();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    await truncateTables();
  });

  describe('upsertSubscription()', () => {
    it('Should insert a new device when upserting a subscription', async () => {
      jest.spyOn(dataSource, 'transaction');
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });

      const notificationDeviceRepository =
        dataSource.getRepository(NotificationDevice);
      const device = await notificationDeviceRepository.findOneBy({
        device_uuid: upsertSubscriptionsDto.deviceUuid as UUID,
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(device).toHaveProperty('device_uuid');
      expect(device?.device_uuid).toBe(upsertSubscriptionsDto.deviceUuid);
    });

    it('Should deletePreviousSubscriptions() when upserting a subscription', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );

      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });
      const subscriptionBeforeRemoval =
        await notificationSubscriptionRepository.findOneBy({
          signer_address: authPayload.signer_address,
          chain_id: upsertSubscriptionsDto.safes[0].chainId,
          safe_address: upsertSubscriptionsDto.safes[0].address,
        });
      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });
      const subscriptionAfterRemoval =
        await notificationSubscriptionRepository.findOne({
          where: {
            signer_address: authPayload.signer_address,
            chain_id: upsertSubscriptionsDto.safes[0].chainId,
            safe_address: upsertSubscriptionsDto.safes[0].address,
            push_notification_device: {
              device_uuid: upsertSubscriptionsDto.deviceUuid as UUID,
            },
          },
          relations: ['push_notification_device'],
        });

      expect(subscriptionBeforeRemoval).toHaveProperty('chain_id');
      expect(subscriptionBeforeRemoval?.id).not.toEqual(
        subscriptionAfterRemoval?.id,
      );
    });

    it('Should upsert a new subscription object when upserting subscriptions', async () => {
      jest.spyOn(dataSource, 'transaction');
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const upsertSubscriptionResult =
        await notificationsRepositoryService.upsertSubscriptions({
          authPayload,
          upsertSubscriptionsDto,
        });

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );

      const subscription = await notificationSubscriptionRepository.findBy({
        signer_address: authPayload.signer_address,
        chain_id: upsertSubscriptionsDto.safes[0].chainId,
        safe_address: upsertSubscriptionsDto.safes[0].address,
        push_notification_device: {
          device_uuid: upsertSubscriptionResult.deviceUuid,
        },
      });

      expect(subscription).toHaveLength(1);
    });

    it('Should upsert subscription notification types object when upserting subscriptions', async () => {
      jest.spyOn(dataSource, 'transaction');
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const upsertSubscriptionResult =
        await notificationsRepositoryService.upsertSubscriptions({
          authPayload,
          upsertSubscriptionsDto,
        });

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );
      const notificationSubscriptionNotificationTypeRepository =
        dataSource.getRepository(NotificationSubscriptionNotificationType);

      const subscriptions: Array<NotificationSubscription> = [];
      for (const safe of upsertSubscriptionsDto.safes) {
        const subscriptionQuery =
          await notificationSubscriptionRepository.findBy({
            signer_address: authPayload.signer_address,
            chain_id: safe.chainId,
            safe_address: safe.address,
            push_notification_device: {
              device_uuid: upsertSubscriptionResult.deviceUuid,
            },
          });
        subscriptions.push(...subscriptionQuery);
      }

      const subscriptionIds = subscriptions.map(
        (subscription) => subscription.id,
      );
      const subscriptionNotificationTypes =
        await notificationSubscriptionNotificationTypeRepository.find({
          where: {
            notification_subscription: {
              id: In(subscriptionIds),
            },
          },
          relations: ['notification_type', 'notification_subscription'],
        });

      const upsertNotificationTypes: Array<string> = [];
      upsertSubscriptionsDto.safes.map((safe) => {
        upsertNotificationTypes.push(...safe.notificationTypes);
      });

      expect(upsertNotificationTypes.length).toBe(
        subscriptionNotificationTypes.length,
      );
      for (const subscriptionNotificationType of subscriptionNotificationTypes) {
        expect(upsertNotificationTypes).toContain(
          subscriptionNotificationType.notification_type.name,
        );
      }
    });

    it('Should not commit if a new subscription object cannot be upserted', async () => {
      await dataSource.transaction(
        async (entityManager: EntityManager): Promise<unknown> => {
          const databaseTransaction = entityManager;

          jest
            .spyOn(postgresDatabaseService, 'transaction')
            .mockImplementation(
              <T>(
                runInTransaction: (entityManager: EntityManager) => Promise<T>,
              ): Promise<T> => {
                return runInTransaction(databaseTransaction);
              },
            );

          jest
            .spyOn(databaseTransaction, 'upsert')
            .mockImplementationOnce(() => {
              throw new Error('Error');
            });

          const authPayloadDto = authPayloadDtoBuilder().build();
          const authPayload = new AuthPayload(authPayloadDto);
          const upsertSubscriptionsDto =
            upsertSubscriptionsDtoBuilder().build();

          try {
            await notificationsRepositoryService.upsertSubscriptions({
              authPayload,
              upsertSubscriptionsDto,
            });
          } catch {
            //
          }

          const notificationSubscriptionRepository =
            entityManager.getRepository(NotificationSubscription);
          const notificationDeviceRepository =
            entityManager.getRepository(NotificationDevice);
          const subscription =
            await notificationSubscriptionRepository.findOneBy({
              signer_address: authPayload.signer_address,
              chain_id: upsertSubscriptionsDto.safes[0].chainId,
              safe_address: upsertSubscriptionsDto.safes[0].address,
            });

          const device = await notificationDeviceRepository.findOneBy({
            device_uuid: upsertSubscriptionsDto.deviceUuid as UUID,
          });

          expect(device).toBeNull();
          expect(subscription).toBeNull();

          return;
        },
      );
    });
  });

  describe('getSafeSubscription()', () => {
    it('Should return a safe subscriptions successfully', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });
      const subscriptions =
        await notificationsRepositoryService.getSafeSubscription({
          authPayload,
          deviceUuid: upsertSubscriptionsDto.deviceUuid as UUID,
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
        });

      for (const subscription of subscriptions) {
        expect(NotificationTypeEnum).toHaveProperty(subscription.name);
      }
    });
    it('Should return an empty array if no subscriptions found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const subscriptions =
        await notificationsRepositoryService.getSafeSubscription({
          authPayload,
          deviceUuid: upsertSubscriptionsDto.deviceUuid as UUID,
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
        });

      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('getSubscribersBySafe()', () => {
    it('Should get safe subscribers successfully', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const secondAuthPayloadDto = authPayloadDtoBuilder().build();
      const secondAuthPayload = new AuthPayload(secondAuthPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });
      await notificationsRepositoryService.upsertSubscriptions({
        authPayload: secondAuthPayload,
        upsertSubscriptionsDto,
      });

      const safeSubscriptions =
        await notificationsRepositoryService.getSubscribersBySafe({
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
        });

      expect(safeSubscriptions).toHaveLength(2);

      const safeSubscription = safeSubscriptions.find(
        (subscription) =>
          subscription.subscriber === authPayload.signer_address,
      );
      const secondSafeSubscription = safeSubscriptions.find(
        (subscription) =>
          subscription.subscriber === secondAuthPayload.signer_address,
      );

      expect(safeSubscription).toHaveProperty('subscriber');
      expect(secondSafeSubscription).toHaveProperty('subscriber');
    });

    it('Should return an empty array if no subscriber exists', async () => {
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const safeSubscriptions =
        await notificationsRepositoryService.getSubscribersBySafe({
          chainId: upsertSubscriptionsDto.safes[0].chainId,
          safeAddress: upsertSubscriptionsDto.safes[0].address,
        });

      expect(safeSubscriptions).toHaveLength(0);
    });
  });

  describe('deleteSubscription()', () => {
    it('Should delete a subscription successfully', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );

      const subscriptionBeforeRemoval =
        await notificationSubscriptionRepository.findBy({
          safe_address: upsertSubscriptionsDto.safes[0].address,
          chain_id: upsertSubscriptionsDto.safes[0].chainId,
          signer_address: authPayload.signer_address,
        });

      await notificationsRepositoryService.deleteSubscription({
        deviceUuid: upsertSubscriptionsDto.deviceUuid as UUID,
        chainId: upsertSubscriptionsDto.safes[0].chainId,
        safeAddress: upsertSubscriptionsDto.safes[0].address,
      });

      const subscriptionAfterRemoval =
        await notificationSubscriptionRepository.findBy({
          safe_address: upsertSubscriptionsDto.safes[0].address,
          chain_id: upsertSubscriptionsDto.safes[0].chainId,
          signer_address: authPayload.signer_address,
        });

      expect(subscriptionBeforeRemoval).toHaveLength(1);
      expect(subscriptionAfterRemoval).toHaveLength(0);
    });

    it('Should throw NotFoundException if a subscription does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );
      jest.spyOn(notificationSubscriptionRepository, 'remove');

      const subscription = await notificationSubscriptionRepository.findBy({
        safe_address: upsertSubscriptionsDto.safes[0].address,
        chain_id: upsertSubscriptionsDto.safes[0].chainId,
        signer_address: authPayload.signer_address,
      });

      const result = notificationsRepositoryService.deleteSubscription({
        deviceUuid: upsertSubscriptionsDto.deviceUuid as UUID,
        chainId: upsertSubscriptionsDto.safes[0].chainId,
        safeAddress: upsertSubscriptionsDto.safes[0].address,
      });

      await expect(result).rejects.toThrow(
        new NotFoundException('No Subscription Found!'),
      );
      expect(subscription).toHaveLength(0);
    });

    it('Should not try to remove if a subscription does not exist', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );
      jest.spyOn(notificationSubscriptionRepository, 'remove');

      const subscription = await notificationSubscriptionRepository.findBy({
        safe_address: upsertSubscriptionsDto.safes[0].address,
        chain_id: upsertSubscriptionsDto.safes[0].chainId,
        signer_address: authPayload.signer_address,
      });

      const result = notificationsRepositoryService.deleteSubscription({
        deviceUuid: upsertSubscriptionsDto.deviceUuid as UUID,
        chainId: upsertSubscriptionsDto.safes[0].chainId,
        safeAddress: upsertSubscriptionsDto.safes[0].address,
      });

      await expect(result).rejects.toThrow();
      expect(subscription).toHaveLength(0);
      expect(notificationSubscriptionRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('deleteDevice()', () => {
    it('Should delete a device successfully', async () => {
      const deviceDto = notificationDeviceBuilder()
        .with('id', faker.number.int({ min: 1, max: 1999 }))
        .build();

      const notificationDeviceRepository =
        dataSource.getRepository(NotificationDevice);
      const device = await notificationDeviceRepository.save(deviceDto);

      await notificationsRepositoryService.deleteDevice(device.device_uuid);

      const findDevice = await notificationDeviceRepository.findOneBy({
        id: device.id,
      });

      expect(findDevice).toBeNull();
    });

    it('Should throw NotFoundException if a uuid does not exist', async () => {
      const deviceDto = notificationDeviceBuilder()
        .with('id', faker.number.int({ min: 1, max: 1999 }))
        .build();

      const result = notificationsRepositoryService.deleteDevice(
        deviceDto.device_uuid,
      );

      await expect(result).rejects.toThrow(
        new NotFoundException('No Device Found!'),
      );
    });

    it('Should delete a device with its subscription', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
      await notificationsRepositoryService.upsertSubscriptions({
        authPayload,
        upsertSubscriptionsDto,
      });

      const notificationDeviceRepository =
        dataSource.getRepository(NotificationDevice);

      const notificationSubscriptionRepository = dataSource.getRepository(
        NotificationSubscription,
      );

      await notificationsRepositoryService.deleteDevice(
        upsertSubscriptionsDto.deviceUuid as UUID,
      );

      const device = await notificationDeviceRepository.find({
        where: {
          device_uuid: upsertSubscriptionsDto.deviceUuid as UUID,
        },
      });
      const subscription = await notificationSubscriptionRepository.find({
        where: {
          push_notification_device: {
            device_uuid: upsertSubscriptionsDto.deviceUuid as UUID,
          },
        },
      });

      expect(device).toHaveLength(0);
      expect(subscription).toHaveLength(0);
    });
  });
});
