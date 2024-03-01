import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
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
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { registerDeviceDtoBuilder } from '@/routes/notifications/entities/__tests__/register-device.dto.builder';
import { safeRegistrationBuilder } from '@/routes/notifications/entities/__tests__/safe-registration.builder';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { RegisterDeviceDto } from '@/routes/notifications/entities/register-device.dto.entity';

describe('Notifications Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
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

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  const buildInputDto = (): RegisterDeviceDto =>
    registerDeviceDtoBuilder()
      .with(
        'safeRegistrations',
        Array.from({ length: 4 }).map((_, i) => {
          return safeRegistrationBuilder()
            .with('chainId', i.toString())
            .build();
        }),
      )
      .build();

  const rejectForUrl = (url: string): Promise<never> =>
    Promise.reject(`No matching rule for url: ${url}`);

  describe('POST /register/notifications', () => {
    it('Success', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build(), status: 200 })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(200)
        .expect({});
    });

    it('Client errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation((url) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build(), status: 200 })
          : rejectForUrl(url);
      });
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 400, max: 499 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(400)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            statusCode: 400,
            message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistrations[0].chainId}`,
            error: 'Bad Request',
          }),
        );
    });

    it('Server errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build(), status: 200 })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 500, max: 599 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistrations[0].chainId}`,
          error: 'Internal Server Error',
        });
    });

    it('Both client and server errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation((url) => {
        return url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build(), status: 200 })
          : rejectForUrl(url);
      });
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 400, max: 499 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(
              new NetworkResponseError(
                new URL(`${safeConfigUrl}/api/v1/notifications/devices`),
                {
                  status: faker.number.int({ min: 500, max: 599 }),
                } as Response,
              ),
            )
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${[
            registerDeviceDto.safeRegistrations[0].chainId,
            registerDeviceDto.safeRegistrations[1].chainId,
          ]}`,
          error: 'Internal Server Error',
        });
    });

    it('No status code errors returned from provider', async () => {
      const registerDeviceDto = buildInputDto();
      networkService.get.mockImplementation((url) =>
        url.includes(`${safeConfigUrl}/api/v1/chains/`)
          ? Promise.resolve({ data: chainBuilder().build(), status: 200 })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );
      networkService.post.mockImplementationOnce((url) =>
        url.includes(`/api/v1/notifications/devices`)
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );
      networkService.post.mockImplementation((url) =>
        url.includes('/api/v1/notifications/devices/')
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .post('/v1/register/notifications')
        .send(registerDeviceDto)
        .expect(500)
        .expect({
          statusCode: 500,
          message: `Push notification registration failed for chain IDs: ${registerDeviceDto.safeRegistrations[1].chainId}`,
          error: 'Internal Server Error',
        });
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}`;
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url === expectedProviderURL
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(200)
        .expect({});
      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith(expectedProviderURL);
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.string.uuid();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chain.chainId}/notifications/devices/${uuid}`)
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /chains/:chainId/notifications/devices/:uuid/safes/:safeAddress', () => {
    it('Success', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const expectedProviderURL = `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url === expectedProviderURL
          ? Promise.resolve({ data: {}, status: 200 })
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(200)
        .expect({});
      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith(expectedProviderURL);
    });

    it('Failure: Config API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chainId}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(0);
    });

    it('Failure: Transaction API fails', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : rejectForUrl(url),
      );
      networkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`
          ? Promise.reject(new Error())
          : rejectForUrl(url),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/notifications/devices/${uuid}/safes/${safeAddress}`,
        )
        .expect(503);
      expect(networkService.delete).toHaveBeenCalledTimes(1);
    });
  });
});
