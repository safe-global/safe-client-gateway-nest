import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { addRecoveryModuleDtoBuilder } from '@/routes/recovery/entities/__tests__/add-recovery-module.dto.builder';
import { omit } from 'lodash';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Recovery (Unit)', () => {
  let app: INestApplication;
  let alertsUrl: string;
  let alertsAccount: string;
  let alertsProject: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        email: true,
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

    const configurationService = moduleFixture.get(IConfigurationService);
    alertsUrl = configurationService.get('alerts.baseUri');
    alertsAccount = configurationService.get('alerts.account');
    alertsProject = configurationService.get('alerts.project');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST add recovery module for a Safe', () => {
    it('Success', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();

      networkService.post.mockImplementation((url) =>
        url ===
        `${alertsUrl}/api/v2/accounts/${alertsAccount}/projects/${alertsProject}/contracts`
          ? Promise.resolve({ status: 200, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/safes/${safeAddress}/recovery`)
        .send(addRecoveryModuleDto)
        .expect(200);
    });

    it('should get a validation error', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/safes/${safeAddress}/recovery`)
        .send(omit(addRecoveryModuleDto, 'moduleAddress'))
        .expect(500)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });

    it('Should return the alerts provider error message', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v2/accounts/${alertsAccount}/projects/${alertsProject}/contracts`,
        ),
        {
          status: 400,
        } as Response,
        {
          message: 'Malformed body',
          status: 400,
        },
      );

      networkService.post.mockImplementation((url) =>
        url ===
        `${alertsUrl}/api/v2/accounts/${alertsAccount}/projects/${alertsProject}/contracts`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/safes/${safeAddress}/recovery`)
        .send(addRecoveryModuleDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v2/accounts/${alertsAccount}/projects/${alertsProject}/contracts`,
        ),
        {
          status: statusCode,
        } as Response,
      );

      networkService.post.mockImplementation((url) =>
        url ===
        `${alertsUrl}/api/v2/accounts/${alertsAccount}/projects/${alertsProject}/contracts`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/safes/${safeAddress}/recovery`)
        .send(addRecoveryModuleDto)
        .expect(statusCode)
        .expect({
          message: 'An error occurred',
          code: statusCode,
        });
    });
  });
});
