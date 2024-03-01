import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { backboneBuilder } from '@/domain/backbone/entities/__tests__/backbone.builder';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { masterCopyBuilder } from '@/domain/chains/entities/__tests__/master-copy.builder';
import { Chain } from '@/domain/chains/entities/chain.entity';
import {
  MasterCopy as DomainMasterCopy,
  MasterCopy,
} from '@/domain/chains/entities/master-copies.entity';
import { Page } from '@/domain/entities/page.entity';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Chains Controller (Unit)', () => {
  let app: INestApplication;

  let safeConfigUrl: string;
  let name: string;
  let version: string;
  let buildNumber: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: null,
    previous: null,
    results: [chainBuilder().build(), chainBuilder().build()],
  };

  const chainResponse: Chain = chainBuilder().build();
  const backboneResponse: Backbone = backboneBuilder().build();

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
    name = configurationService.get('about.name');
    version = configurationService.get('about.version');
    buildNumber = configurationService.get('about.buildNumber');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET /chains', () => {
    it('Success', async () => {
      networkService.get.mockResolvedValueOnce({
        data: chainsResponse,
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains')
        .expect(200)
        .expect({
          count: chainsResponse.count,
          next: null,
          previous: null,
          results: [
            {
              chainId: chainsResponse.results[0].chainId,
              chainName: chainsResponse.results[0].chainName,
              description: chainsResponse.results[0].description,
              l2: chainsResponse.results[0].l2,
              shortName: chainsResponse.results[0].shortName,
              rpcUri: chainsResponse.results[0].rpcUri,
              safeAppsRpcUri: chainsResponse.results[0].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[0].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[0].blockExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[0].nativeCurrency,
              transactionService: chainsResponse.results[0].transactionService,
              theme: chainsResponse.results[0].theme,
              gasPrice: chainsResponse.results[0].gasPrice,
              ensRegistryAddress: chainsResponse.results[0].ensRegistryAddress,
              disabledWallets: chainsResponse.results[0].disabledWallets,
              features: chainsResponse.results[0].features,
            },
            {
              chainId: chainsResponse.results[1].chainId,
              chainName: chainsResponse.results[1].chainName,
              description: chainsResponse.results[1].description,
              l2: chainsResponse.results[1].l2,
              shortName: chainsResponse.results[1].shortName,
              rpcUri: chainsResponse.results[1].rpcUri,
              safeAppsRpcUri: chainsResponse.results[1].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[1].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[1].blockExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[1].nativeCurrency,
              transactionService: chainsResponse.results[1].transactionService,
              theme: chainsResponse.results[1].theme,
              gasPrice: chainsResponse.results[1].gasPrice,
              ensRegistryAddress: chainsResponse.results[1].ensRegistryAddress,
              disabledWallets: chainsResponse.results[1].disabledWallets,
              features: chainsResponse.results[1].features,
            },
          ],
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith(
        `${safeConfigUrl}/api/v1/chains`,
        {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      );
    });

    it('Failure: network service fails', async () => {
      const error = new NetworkResponseError(
        new URL(`${safeConfigUrl}/v1/chains`),
        {
          status: 500,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer()).get('/v1/chains').expect(500).expect({
        message: 'An error occurred',
        code: 500,
      });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith(
        `${safeConfigUrl}/api/v1/chains`,
        {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      );
    });

    it('Failure: received data is not valid', async () => {
      networkService.get.mockResolvedValueOnce({
        data: {
          ...chainsResponse,
          results: [...chainsResponse.results, { invalid: 'item' }],
        },
        status: 200,
      });

      await request(app.getHttpServer()).get('/v1/chains').expect(500).expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith(
        `${safeConfigUrl}/api/v1/chains`,
        {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      );
    });
  });

  describe('GET /:chainId', () => {
    it('Success', async () => {
      const chainId = faker.string.numeric();
      const chainDomain = chainBuilder().with('chainId', chainId).build();
      const expectedResult = {
        chainId: chainDomain.chainId,
        chainName: chainDomain.chainName,
        description: chainDomain.description,
        l2: chainDomain.l2,
        nativeCurrency: chainDomain.nativeCurrency,
        transactionService: chainDomain.transactionService,
        blockExplorerUriTemplate: chainDomain.blockExplorerUriTemplate,
        disabledWallets: chainDomain.disabledWallets,
        features: chainDomain.features,
        gasPrice: chainDomain.gasPrice,
        publicRpcUri: chainDomain.publicRpcUri,
        rpcUri: chainDomain.rpcUri,
        safeAppsRpcUri: chainDomain.safeAppsRpcUri,
        shortName: chainDomain.shortName,
        theme: chainDomain.theme,
        ensRegistryAddress: chainDomain.ensRegistryAddress,
      };
      networkService.get.mockResolvedValueOnce({
        data: chainDomain,
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(200)
        .expect(expectedResult);
    });

    it('Should return not Not found', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 404,
        } as Response,
        { message: 'Not Found' },
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(404)
        .expect({
          message: 'Not Found',
          code: 404,
        });
    });

    it('Should fail with An error occurred', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 503,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('GET /:chainId/about/backbone', () => {
    it('Success', async () => {
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: backboneResponse,
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(200)
        .expect(backboneResponse);

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(networkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Failure getting the chain', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 400,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith(
        `${safeConfigUrl}/api/v1/chains/1`,
        undefined,
      );
    });

    it('Failure getting the backbone data', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/about`),
        {
          status: 502,
        } as Response,
      );
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(networkService.get.mock.calls[1][1]).toBe(undefined);
    });
  });

  describe('GET /:chainId/about/master-copies', () => {
    it('Success', async () => {
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      const domainMasterCopiesResponse: DomainMasterCopy[] = [
        masterCopyBuilder().build(),
        masterCopyBuilder().build(),
      ];
      networkService.get.mockResolvedValueOnce({
        data: domainMasterCopiesResponse,
        status: 200,
      });
      const masterCopiesResponse = [
        {
          address: domainMasterCopiesResponse[0].address,
          version: domainMasterCopiesResponse[0].version,
        } as MasterCopy,
        {
          address: domainMasterCopiesResponse[1].address,
          version: domainMasterCopiesResponse[1].version,
        } as MasterCopy,
      ];

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(200)
        .expect(masterCopiesResponse);

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about/master-copies/`,
      );
      expect(networkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Failure getting the chain', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/chains/1`),
        {
          status: 400,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith(
        `${safeConfigUrl}/api/v1/chains/1`,
        undefined,
      );
    });

    it('Should fail getting the master-copies data', async () => {
      const error = new NetworkResponseError(
        new URL(
          `${chainResponse.transactionService}/api/v1/about/master-copies/`,
        ),
        {
          status: 502,
        } as Response,
      );
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0]).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about/master-copies/`,
      );
      expect(networkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Should return validation error', async () => {
      networkService.get.mockResolvedValueOnce({
        data: chainResponse,
        status: 200,
      });
      const domainMasterCopiesResponse = [
        { address: 1223, safe: 'error' },
        masterCopyBuilder().build(),
      ];
      networkService.get.mockResolvedValueOnce({
        data: domainMasterCopiesResponse,
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });

  describe('GET /:chainId/about', () => {
    it('Success', async () => {
      const chainDomain = chainBuilder().build();
      const expectedResult = {
        transactionServiceBaseUri: chainDomain.transactionService,
        name,
        version,
        buildNumber,
      };
      networkService.get.mockResolvedValueOnce({
        data: chainDomain,
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainDomain.chainId}/about`)
        .expect(200)
        .expect(expectedResult);
    });

    it('Should return not Not found', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 404,
        } as Response,
        { message: 'Not Found' },
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/about`)
        .expect(404)
        .expect({
          message: 'Not Found',
          code: 404,
        });
    });

    it('Should fail with An error occurred', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 503,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/about`)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });
});
