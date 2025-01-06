import { faker } from '@faker-js/faker';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { registerDeviceDtoBuilder } from '@/routes/notifications/v1/entities/__tests__/register-device.dto.builder';
import { safeRegistrationBuilder } from '@/routes/notifications/v1/entities/__tests__/safe-registration.builder';
import type { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { getAddress } from 'viem';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/domain/notifications/v2/test.notification.repository.module';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import { NotificationsModuleV2 } from '@/routes/notifications/v2/notifications.module';
import { TestNotificationsModuleV2 } from '@/routes/notifications/v2/test.notifications.module';
import type { UUID } from 'crypto';
import { createV2RegisterDtoBuilder } from '@/routes/notifications/v1/entities/__tests__/create-registration-v2.dto.builder';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';

describe('Notifications Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let loggingService: jest.MockedObjectDeep<ILoggingService>;
  let notificationServiceV2: jest.MockedObjectDeep<NotificationsServiceV2>;
  const REGISTRATION_TIMESTAMP_EXPIRY_MINUTES = 5;
  const REGISTRATION_TIMESTAMP_EXPIRY =
    REGISTRATION_TIMESTAMP_EXPIRY_MINUTES * 60;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();

    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        pushNotifications: true,
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
      .overrideModule(NotificationsRepositoryV2Module)
      .useModule(TestNotificationsRepositoryV2Module)
      .overrideModule(NotificationsModuleV2)
      .useModule(TestNotificationsModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    notificationServiceV2 = moduleFixture.get(NotificationsServiceV2);
    loggingService = moduleFixture.get(LoggingService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  const buildInputDto = async (
    safeRegistrationsLength: number = 4,
  ): Promise<RegisterDeviceDto> => {
    const uuid = faker.string.uuid() as UUID;
    const cloudMessagingToken = faker.string.uuid() as UUID;
    const currentTimestampInSeconds = Math.floor(new Date().getTime() / 1000);

    const safeRegistrations = await Promise.all(
      faker.helpers.multiple(
        async () => {
          const safeRegistration = await safeRegistrationBuilder({
            signaturePrefix: 'gnosis-safe',
            uuid,
            cloudMessagingToken,
            timestamp: currentTimestampInSeconds,
          });
          return safeRegistration
            .with('chainId', faker.number.int({ min: 1, max: 100 }).toString())
            .build();
        },
        { count: safeRegistrationsLength },
      ),
    );

    return (
      await registerDeviceDtoBuilder({
        uuid,
        cloudMessagingToken,
        timestamp: currentTimestampInSeconds,
      })
    )
      .with('safeRegistrations', safeRegistrations)
      .build();
  };

  const rejectForUrl = (url: string): Promise<never> =>
    Promise.reject(`No matching rule for url: ${url}`);

  describe('POST /register/notifications', () => {
    it.each([5, 20])(
      'Success for a subscription with %i safe registrations',
      async (safeRegistrationLength: number) => {
        const registerDeviceDto = await buildInputDto(safeRegistrationLength);
        const upsertSubscriptionsV2Dto =
          await createV2RegisterDtoBuilder(registerDeviceDto);

        networkService.get.mockImplementation(({ url }) =>
          url.includes(`${safeConfigUrl}/api/v1/chains/`)
            ? Promise.resolve({
                data: rawify(chainBuilder().build()),
                status: 200,
              })
            : rejectForUrl(url),
        );
        networkService.post.mockImplementation(({ url }) =>
          url.includes('/api/v1/notifications/devices/')
            ? Promise.resolve({ data: rawify({}), status: 200 })
            : rejectForUrl(url),
        );

        await request(app.getHttpServer())
          .post('/v1/register/notifications')
          .send(registerDeviceDto)
          .expect(200)
          .expect({});

        // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
        // We call V2 as many times as we have a registration with at least one safe
        const safeRegistrationsWithSafe =
          registerDeviceDto.safeRegistrations.filter(
            (safeRegistration) => safeRegistration.safes.length > 0,
          );

        expect(notificationServiceV2.upsertSubscriptions).toHaveBeenCalledTimes(
          safeRegistrationsWithSafe.length,
        );

        for (const [
          index,
          upsertSubscriptionsV2,
        ] of upsertSubscriptionsV2Dto.entries()) {
          const nthCall = index + 1; // Convert zero-based index to a one-based call number
          expect(
            notificationServiceV2.upsertSubscriptions,
          ).toHaveBeenNthCalledWith(nthCall, upsertSubscriptionsV2);
        }
      },
    );

    it(`Should throw if the timestamp in request is older than ${REGISTRATION_TIMESTAMP_EXPIRY_MINUTES} minutes ago`, async () => {
      const registerDeviceDto = await buildInputDto();
      const expiryThresholdSeconds = REGISTRATION_TIMESTAMP_EXPIRY + 60;
      const expiredDateTime =
        parseInt(registerDeviceDto.timestamp!) - expiryThresholdSeconds;
      const expiredTimestampInSeconds = Math.floor(expiredDateTime);
      registerDeviceDto.timestamp = expiredTimestampInSeconds.toString();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(400)
        .expect({
          message: 'The signature is expired!',
          error: 'Bad Request',
          statusCode: 400,
        });

      expect(notificationServiceV2.upsertSubscriptions).not.toHaveBeenCalled();
    });

    it(`Should throw if the timestamp is more than ${REGISTRATION_TIMESTAMP_EXPIRY_MINUTES} minutes in the future`, async () => {
      const registerDeviceDto = await buildInputDto();
      const expiryThresholdSeconds = REGISTRATION_TIMESTAMP_EXPIRY + 60;
      const expiryDateTime =
        parseInt(registerDeviceDto.timestamp!) + expiryThresholdSeconds;
      const expiredTimestampInSeconds = Math.floor(expiryDateTime);
      registerDeviceDto.timestamp = expiredTimestampInSeconds.toString();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(400)
        .expect({
          message: 'The signature is expired!',
          error: 'Bad Request',
          statusCode: 400,
        });

      expect(notificationServiceV2.upsertSubscriptions).not.toHaveBeenCalled();
    });

    it(`Should pass if the timestamp in within then last ${REGISTRATION_TIMESTAMP_EXPIRY_MINUTES} minutes`, async () => {
      const registerDeviceDto = await buildInputDto();
      const expiredDateTime = parseInt(registerDeviceDto.timestamp!) * 1000;
      const expiredTimestampInSeconds = Math.floor(expiredDateTime / 1000);
      registerDeviceDto.timestamp = expiredTimestampInSeconds.toString();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation(({ url }) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(200);

      expect(notificationServiceV2.upsertSubscriptions).toHaveBeenCalled();
    });

    it('Should not log the error if a device is not found in the TX service', async () => {
      jest.spyOn(loggingService, 'error');
      const registerDeviceDto = await buildInputDto();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url.includes(`/api/v1/notifications/devices/`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: 404,
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(200);

      expect(notificationServiceV2.upsertSubscriptions).toHaveBeenCalled();
      expect(loggingService.error).not.toHaveBeenCalled();
    });

    it('Should log an error if the TX service throws a non-404 exception', async () => {
      loggingService.error = jest.fn();
      const registerDeviceDto = await buildInputDto();
      networkService.get.mockImplementation(({ url }) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({
              data: rawify(chainBuilder().build()),
              status: 200,
            })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url.includes(`/api/v1/notifications/devices/`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: 503,
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(200);

      expect(notificationServiceV2.upsertSubscriptions).toHaveBeenCalled();
      expect(loggingService.error).toHaveBeenCalledTimes(
        registerDeviceDto.safeRegistrations.length,
      );
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}`;
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === expectedProviderURL
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200)
        .expect({});
      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: expectedProviderURL,
      });

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledWith(uuid);
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(0);
    });

    it('Should not throw when the notificationServiceV2 throws a NotFoundException', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      notificationServiceV2.deleteDevice.mockRejectedValue(
        new NotFoundException(),
      );
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200);

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });

    it('Should throw when the notificationServiceV2 throws a non-NotFoundException error', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      notificationServiceV2.deleteDevice.mockRejectedValue(new Error());
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(500);

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(networkService.delete).not.toHaveBeenCalledTimes(1);
    });

    it('Should not throw when the TX service throws a 404 error', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();

      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.reject(
              new NetworkResponseError(
                new URL(
                  `${chain.transactionService}/api/v1/notifications/devices/${uuid}`,
                ),
                {
                  status: 404,
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200);

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });

    it('Should throw when the TX service throws a non-404 error', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();

      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.reject(
              new NetworkResponseError(
                new URL(
                  `${chain.transactionService}/api/v1/notifications/devices/${uuid}`,
                ),
                {
                  status: 500,
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(500);

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid/safes/:safeAddress', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      // ValidationPipe checksums safeAddress param
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === expectedProviderURL
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(200)
        .expect({});
      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: expectedProviderURL,
      });

      expect(notificationServiceV2.deleteSubscription).toHaveBeenCalledTimes(1);
      expect(notificationServiceV2.deleteSubscription).toHaveBeenCalledWith({
        deviceUuid: uuid,
        chainId: chain.chainId,
        safeAddress: safeAddress,
      });
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(notificationServiceV2.deleteSubscription).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(0);
    });

    it('Should not throw when the notificationServiceV2 throws a NotFoundException', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      notificationServiceV2.deleteDevice.mockRejectedValue(
        new NotFoundException(),
      );
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200);

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });

    it('Should throw when the notificationServiceV2 throws a non-NotFoundException error', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      notificationServiceV2.deleteDevice.mockRejectedValue(new Error());
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.resolve({ data: rawify({}), status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(500);

      expect(notificationServiceV2.deleteDevice).toHaveBeenCalledTimes(1);
      expect(networkService.delete).not.toHaveBeenCalledTimes(1);
    });

    it('Should not throw when the TX service throws a 404 error', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();

      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`
          ? Promise.reject(
              new NetworkResponseError(
                new URL(
                  `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`,
                ),
                {
                  status: 404,
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(200);

      expect(notificationServiceV2.deleteSubscription).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });

    it('Should throw when the TX service throws a non-404 error', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();

      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : rejectForUrl(url),
      );

      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`
          ? Promise.reject(
              new NetworkResponseError(
                new URL(
                  `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`,
                ),
                {
                  status: 500,
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(500);

      expect(notificationServiceV2.deleteSubscription).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });
  });
});
