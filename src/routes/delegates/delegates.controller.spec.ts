import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { omit } from 'lodash';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { createDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/create-delegate.dto.builder';
import { deleteDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/delete-delegate.dto.builder';
import { deleteSafeDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/delete-safe-delegate.dto.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Delegates controller', () => {
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

  describe('GET delegates for a Safe', () => {
    it('Success', async () => {
      const safe = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder().with('safe', safe).build(),
          delegateBuilder().with('safe', safe).build(),
        ])
        .build();
      networkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should return a validation error', async () => {
      const safe = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder().with('safe', safe).build(),
          { ...delegateBuilder().with('safe', safe).build(), label: true },
        ])
        .build();
      networkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });

    it('Should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 0)
        .with('next', null)
        .with('previous', null)
        .with('results', [])
        .build();
      networkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should fail with bad request', async () => {
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates`)
        .expect(400)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });
  });

  describe('POST delegates for a Safe', () => {
    it('Success', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation((url) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.resolve({ status: 201, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('should get a validation error', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();

      await request(app.getHttpServer())
        .post(`/v1/chains/${faker.string.numeric()}/delegates/`)
        .send(omit(createDelegateDto, 'signature'))
        .expect(400)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });

    it('Success with safe undefined', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      createDelegateDto.safe = undefined;
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation((url) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.resolve({ status: 201, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.post.mockImplementation((url) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/`;
      const error = new NetworkResponseError(new URL(transactionServiceUrl), {
        status: 503,
      } as Response);
      networkService.post.mockImplementation((url) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('Delete delegates', () => {
    it('Success', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.delete.mockImplementation((url) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`;
      const error = new NetworkResponseError(new URL(transactionServiceUrl), {
        status: 503,
      } as Response);
      networkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });

    it('Should get a validation error', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send({ ...deleteDelegateDto, signature: faker.number.int() })
        .expect(400)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });
  });

  describe('Delete Safe delegates', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`,
        )
        .send(deleteSafeDelegateDto)
        .expect(200);
    });

    it('Should return errors from provider', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.delete.mockImplementation((url) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`,
        )
        .send(deleteSafeDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should get a validation error', async () => {
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${faker.string.numeric()}/safes/${
            deleteSafeDelegateDto.safe
          }/delegates/${deleteSafeDelegateDto.delegate}`,
        )
        .send({ ...deleteSafeDelegateDto, safe: faker.datatype.boolean() })
        .expect(400)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });
  });
});
