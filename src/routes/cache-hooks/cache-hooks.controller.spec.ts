import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
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

describe('Post Hook Events (Unit)', () => {
  let app: INestApplication;
  let authToken: string;
  let safeConfigUrl: string;
  let fakeCacheService: FakeCacheService;
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
    app = moduleFixture.createNestApplication();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    const configurationService = moduleFixture.get(IConfigurationService);
    authToken = configurationService.get('auth.token');
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw an error if authorization is not sent in the request headers', async () => {
    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .send({})
      .expect(403);
  });

  it.each([
    {
      type: 'DELETED_MULTISIG_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_ETHER',
      address: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'INCOMING_TOKEN',
      address: faker.finance.ethereumAddress(),
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_ETHER',
      address: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      address: faker.finance.ethereumAddress(),
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'NEW_CONFIRMATION',
      address: faker.finance.ethereumAddress(),
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MODULE_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MESSAGE_CREATED',
      address: faker.finance.ethereumAddress(),
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MESSAGE_CONFIRMATION',
      address: faker.finance.ethereumAddress(),
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'CHAIN_UPDATE',
    },
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('accepts $type', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);
  });

  it('returns 400 (Bad Request) on unknown payload', async () => {
    const data = {
      type: 'SOME_TEST_TYPE_THAT_WE_DO_NOT_SUPPORT',
      safeTxHash: 'some-safe-tx-hash',
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/1`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', '1').build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(400);
  });

  it.each([
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears balances', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_balances_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'NEW_CONFIRMATION',
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'DELETED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears multisig transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_multisig_transactions_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'NEW_CONFIRMATION',
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'DELETED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears multisig transaction', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_multisig_transaction_${payload.safeTxHash}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears safe info', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_safe_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears safe collectibles', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_collectibles_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears safe collectible transfers', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_transfers_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
  ])('$type clears incoming transfers', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_incoming_transfers_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears module transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_module_transactions_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears all transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_all_transactions_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'MESSAGE_CREATED',
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MESSAGE_CONFIRMATION',
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears messages', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_messages_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chain', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`${chainId}_chain`, '');
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chains', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`chains`, '');
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('$type clears safe apps', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`${chainId}_safe_apps`, '');
    await fakeCacheService.set(cacheDir, faker.string.alpha());
    const data = {
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });
});
