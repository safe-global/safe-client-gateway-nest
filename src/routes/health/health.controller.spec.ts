import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { INestApplication } from '@nestjs/common';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import * as request from 'supertest';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Health Controller tests', () => {
  let app: INestApplication;
  let cacheService: FakeCacheService;

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

    app = await new TestAppProvider().provide(moduleFixture);

    cacheService = moduleFixture.get(CacheService);

    await app.init();
  });

  describe('readiness tests', () => {
    it('cache service is not ready', async () => {
      cacheService.setReadyState(false);

      await request(app.getHttpServer())
        .get(`/health/ready`)
        .expect(503)
        .expect({ status: 'KO' });
    });

    it('cache service is ready', async () => {
      cacheService.setReadyState(true);

      await request(app.getHttpServer())
        .get(`/health/ready`)
        .expect(200)
        .expect({ status: 'OK' });
    });
  });

  describe('liveness tests', () => {
    it('service is alive if it accepts requests', async () => {
      await request(app.getHttpServer())
        .get(`/health/live`)
        .expect(200)
        .expect({ status: 'OK' });
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
