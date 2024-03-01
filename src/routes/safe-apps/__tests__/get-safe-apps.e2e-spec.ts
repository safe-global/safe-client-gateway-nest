import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RedisClientType } from 'redis';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { SafeApp } from '@/routes/safe-apps/entities/safe-app.entity';

describe('Get Safe Apps e2e test', () => {
  let app: INestApplication;
  let redisClient: RedisClientType;
  const chainId = '5'; // Görli testnet
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .compile();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
  });

  it('GET /chains/<chainId>/safe-apps', async () => {
    const safeAppsCacheKey = `${cacheKeyPrefix}-${chainId}_safe_apps`;
    const safeAppsCacheField = 'undefined_undefined';

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safe-apps`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        body.forEach((safeApp: SafeApp) =>
          expect(safeApp).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              name: expect.any(String),
              url: expect.any(String),
              chainIds: expect.arrayContaining([chainId]),
              iconUrl: expect.any(String),
              description: expect.any(String),
              accessControl: expect.objectContaining({
                type: expect.any(String),
              }),
              tags: expect.any(Array),
              features: expect.any(Array),
              socialProfiles: expect.any(Array),
            }),
          ),
        );
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).not.toBeNull();
  });

  it('GET /chains/<chainId>/safe-apps?url=${transactionBuilderUrl}', async () => {
    const safeAppsCacheKey = `${cacheKeyPrefix}-${chainId}_safe_apps`;
    const transactionBuilderUrl = 'https://safe-apps.dev.5afe.dev/tx-builder';
    const safeAppsCacheField = `undefined_${transactionBuilderUrl}`;

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safe-apps/?url=${transactionBuilderUrl}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(1);
        expect(body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            name: 'Transaction Builder',
            url: transactionBuilderUrl,
            chainIds: expect.arrayContaining([chainId]),
            iconUrl: expect.any(String),
            description: expect.any(String),
            accessControl: expect.objectContaining({
              type: expect.any(String),
            }),
            tags: expect.any(Array),
            features: expect.any(Array),
            socialProfiles: expect.any(Array),
          }),
        );
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).not.toBeNull();
  });
});
