import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';

describe('Post Hook Events (Unit)', () => {
  let app: INestApplication<Server>;
  let authToken: string;
  let configurationService: IConfigurationService;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(config)],
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
    app = moduleFixture.createNestApplication();

    configurationService = moduleFixture.get(IConfigurationService);
    authToken = configurationService.getOrThrow('auth.token');

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp(configuration);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 410 if the hook is not CHAIN_UPDATE or SAFE_APPS_UPDATE', async () => {
    const payload = {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    };
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(410);
  });

  it('should throw an error if authorization is not sent in the request headers', async () => {
    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .send({})
      .expect(403);
  });
});
