import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RedisClientType } from 'redis';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { CacheKeyPrefix } from '@/datasources/cache/constants';

describe('Get safes by owner e2e test', () => {
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

    app = moduleRef.createNestApplication();
    await app.init();
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
  });

  it('GET /owners/<owner_address>/safes', async () => {
    const ownerAddress = '0xf10E2042ec19747401E5EA174EfB63A0058265E6';
    const ownerCacheKey = `${cacheKeyPrefix}-${chainId}_owner_safes_${ownerAddress}`;

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/owners/${ownerAddress}/safes`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({ safes: expect.any(Array) }),
        );
      });

    const cacheContent = await redisClient.hGet(ownerCacheKey, '');
    expect(cacheContent).not.toBeNull();
  });
});
