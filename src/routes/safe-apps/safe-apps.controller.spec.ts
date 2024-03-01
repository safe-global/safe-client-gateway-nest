import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { SafeAppAccessControlPolicies } from '@/domain/safe-apps/entities/safe-app-access-control.entity';
import { safeAppAccessControlBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-access-control.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
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
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Safe Apps Controller (Unit)', () => {
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

  afterAll(async () => {
    await app.close();
  });

  describe('Get Safe Apps', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
              .build(),
          )
          .build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.NoRestrictions)
              .build(),
          )
          .build(),
      ];
      networkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200)
        .expect([
          {
            id: safeAppsResponse[0].id,
            url: safeAppsResponse[0].url,
            name: safeAppsResponse[0].name,
            iconUrl: safeAppsResponse[0].iconUrl,
            description: safeAppsResponse[0].description,
            chainIds: safeAppsResponse[0].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[0].provider,
            accessControl: {
              type: 'DOMAIN_ALLOWLIST',
              value: safeAppsResponse[0].accessControl.value,
            },
            tags: safeAppsResponse[0].tags,
            features: safeAppsResponse[0].features,
            developerWebsite: safeAppsResponse[0].developerWebsite,
            socialProfiles: safeAppsResponse[0].socialProfiles,
          },
          {
            id: safeAppsResponse[1].id,
            url: safeAppsResponse[1].url,
            name: safeAppsResponse[1].name,
            iconUrl: safeAppsResponse[1].iconUrl,
            description: safeAppsResponse[1].description,
            chainIds: safeAppsResponse[1].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[1].provider,
            accessControl: { type: 'NO_RESTRICTIONS' },
            tags: safeAppsResponse[1].tags,
            features: safeAppsResponse[1].features,
            developerWebsite: safeAppsResponse[1].developerWebsite,
            socialProfiles: safeAppsResponse[1].socialProfiles,
          },
        ]);
    });

    it('Success with UNKNOWN accessControl', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [safeAppBuilder().build()];
      networkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({
            data: [
              {
                ...safeAppsResponse[0],
                accessControl: {
                  type: faker.word.sample(),
                  value: safeAppsResponse[0].accessControl.value,
                },
              },
            ],
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(200)
        .expect([
          {
            id: safeAppsResponse[0].id,
            url: safeAppsResponse[0].url,
            name: safeAppsResponse[0].name,
            iconUrl: safeAppsResponse[0].iconUrl,
            description: safeAppsResponse[0].description,
            chainIds: safeAppsResponse[0].chainIds.map((c) => c.toString()),
            provider: safeAppsResponse[0].provider,
            accessControl: { type: 'UNKNOWN' },
            tags: safeAppsResponse[0].tags,
            features: safeAppsResponse[0].features,
            developerWebsite: safeAppsResponse[0].developerWebsite,
            socialProfiles: safeAppsResponse[0].socialProfiles,
          },
        ]);
    });

    it('Should get a data source validation error: DOMAIN_ALLOWLIST values are not URIs', async () => {
      const chain = chainBuilder().build();
      const safeAppsResponse = [
        safeAppBuilder().build(),
        safeAppBuilder()
          .with(
            'accessControl',
            safeAppAccessControlBuilder()
              .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
              .with('value', [
                faker.string.hexadecimal(),
                faker.string.hexadecimal(),
              ])
              .build(),
          )
          .build(),
      ];

      networkService.get.mockImplementation((url) => {
        const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
        if (url === getSafeAppsUrl) {
          return Promise.resolve({ data: safeAppsResponse, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safe-apps`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
