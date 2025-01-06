import request from 'supertest';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  lockEventItemBuilder,
  unlockEventItemBuilder,
  withdrawEventItemBuilder,
  toJson as lockingEventToJson,
} from '@/domain/community/entities/__tests__/locking-event.builder';
import type { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { getAddress } from 'viem';
import { lockingRankBuilder } from '@/domain/community/entities/__tests__/locking-rank.builder';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import {
  campaignBuilder,
  toJson as campaignToJson,
} from '@/domain/community/entities/__tests__/campaign.builder';
import type { Campaign } from '@/domain/community/entities/campaign.entity';
import type { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { campaignRankBuilder } from '@/domain/community/entities/__tests__/campaign-rank.builder';
import type { Server } from 'net';
import {
  campaignActivityBuilder,
  toJson as campaignActivityToJson,
} from '@/domain/community/entities/__tests__/campaign-activity.builder';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { eligibilityRequestBuilder } from '@/domain/community/entities/__tests__/eligibility-request.builder';
import { IdentityApiModule } from '@/datasources/locking-api/identity-api.module';
import { TestIdentityApiModule } from '@/datasources/locking-api/__tests__/test.identity-api.module';
import { IIdentityApi } from '@/domain/interfaces/identity-api.interface';
import { eligibilityBuilder } from '@/domain/community/entities/__tests__/eligibility.builder';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Community (Unit)', () => {
  let app: INestApplication<Server>;
  let lockingBaseUri: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let identityApi: jest.MockedObjectDeep<IIdentityApi>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
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
      .overrideModule(IdentityApiModule)
      .useModule(TestIdentityApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    lockingBaseUri = configurationService.getOrThrow('locking.baseUri');
    networkService = moduleFixture.get(NetworkService);
    identityApi = moduleFixture.get(IIdentityApi);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /community/campaigns', () => {
    it('should get the list of campaigns', async () => {
      const campaignsPage = pageBuilder<Campaign>()
        .with('results', [campaignBuilder().build()])
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns`:
            return Promise.resolve({
              data: rawify(campaignsPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns`)
        .expect(200)
        .expect({
          count: 1,
          next: null,
          previous: null,
          results: campaignsPage.results.map(campaignToJson),
        });
    });

    it('should validate the list of campaigns', async () => {
      const invalidCampaigns = [{ invalid: 'campaign' }];
      const campaignsPage = pageBuilder()
        .with('results', invalidCampaigns)
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns`:
            return Promise.resolve({
              data: rawify(campaignsPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward the pagination parameters', async () => {
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
      const campaignsPage = pageBuilder<Campaign>()
        .with('results', [campaignBuilder().build()])
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns`:
            return Promise.resolve({
              data: rawify(campaignsPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/campaigns?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200)
        .expect({
          count: 1,
          next: null,
          previous: null,
          results: campaignsPage.results.map(campaignToJson),
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward errors from the service', async () => {
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/api/v1/campaigns`),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /community/campaigns/:resourceId', () => {
    it('should get a campaign by ID', async () => {
      const campaign = campaignBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}`:
            return Promise.resolve({ data: rawify(campaign), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${campaign.resourceId}`)
        .expect(200)
        .expect(campaignToJson(campaign) as Campaign);
    });

    it('should validate the response', async () => {
      const invalidCampaign = {
        resourceId: faker.string.uuid(),
        invalid: 'campaign',
      };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${invalidCampaign.resourceId}`:
            return Promise.resolve({
              data: rawify(invalidCampaign),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${invalidCampaign.resourceId}`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward an error from the service', async () => {
      const resourceId = faker.string.uuid();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${resourceId}`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/api/v1/campaigns/${resourceId}`),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${resourceId}`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /campaigns/:resourceId/activity', () => {
    it('should get the campaign activity by campaign ID', async () => {
      const campaign = campaignBuilder().build();
      const campaignActivity = campaignActivityBuilder().build();
      const campaignActivityPage = pageBuilder()
        .with('results', [campaignActivity])
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`:
            return Promise.resolve({
              data: rawify(campaignActivityPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${campaign.resourceId}/activities`)
        .expect(200)
        .expect({
          count: 1,
          next: null,
          previous: null,
          results: [campaignActivityToJson(campaignActivity)],
        });
    });

    it('should get the campaign activity by campaign ID and holder', async () => {
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const campaignActivity = campaignActivityBuilder()
        .with('holder', holder)
        .build();
      const campaignActivityPage = pageBuilder()
        .with('results', [campaignActivity])
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`:
            return Promise.resolve({
              data: rawify(campaignActivityPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/campaigns/${campaign.resourceId}/activities?holder=${holder}`,
        )
        .expect(200)
        .expect({
          count: 1,
          next: null,
          previous: null,
          results: [campaignActivityToJson(campaignActivity)],
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`,
        networkRequest: {
          params: {
            limit: 20,
            offset: 0,
            holder,
          },
        },
      });
    });

    it('should forward the pagination parameters', async () => {
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const campaignActivity = campaignActivityBuilder()
        .with('holder', holder)
        .build();
      const campaignActivityPage = pageBuilder()
        .with('results', [campaignActivity])
        .with('count', 1)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`:
            return Promise.resolve({
              data: rawify(campaignActivityPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/campaigns/${campaign.resourceId}/activities?cursor=limit%3D${limit}%26offset%3D${offset}&holder=${holder}`,
        )
        .expect(200)
        .expect({
          count: 1,
          next: null,
          previous: null,
          results: [campaignActivityToJson(campaignActivity)],
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`,
        networkRequest: {
          params: {
            limit,
            offset,
            holder,
          },
        },
      });
    });

    it('should validate the holder query', async () => {
      const campaign = campaignBuilder().build();
      const holder = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .get(
          `/v1/community/campaigns/${campaign.resourceId}/activities?holder=${holder}`,
        )
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: [],
        });
    });

    it('should validate the response', async () => {
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const invalidCampaignActivity = [{ invalid: 'campaignActivity' }];
      const campaignActivityPage = pageBuilder()
        .with('results', invalidCampaignActivity)
        .with('count', invalidCampaignActivity.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`:
            return Promise.resolve({
              data: rawify(campaignActivityPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/campaigns/${campaign.resourceId}/activities?holder=${holder}`,
        )
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward an error from the service', () => {
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(
                  `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`,
                ),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      return request(app.getHttpServer())
        .get(
          `/v1/community/campaigns/${campaign.resourceId}/activities?holder${holder}`,
        )
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /community/campaigns/:resourceId/leaderboard', () => {
    it('should get the leaderboard by campaign ID', async () => {
      const campaign = campaignBuilder().build();
      const campaignRankPage = pageBuilder<CampaignRank>()
        .with('results', [
          campaignRankBuilder().build(),
          campaignRankBuilder().build(),
        ])
        .with('count', 2)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/leaderboard`:
            return Promise.resolve({
              data: rawify(campaignRankPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${campaign.resourceId}/leaderboard`)
        .expect(200)
        .expect({
          count: 2,
          next: null,
          previous: null,
          results: campaignRankPage.results,
        });
    });

    it('should validate the response', async () => {
      const campaign = campaignBuilder().build();
      const invalidCampaignRanks = [{ invalid: 'campaignRank' }];
      const campaignRankPage = pageBuilder()
        .with('results', invalidCampaignRanks)
        .with('count', invalidCampaignRanks.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/leaderboard`:
            return Promise.resolve({
              data: rawify(campaignRankPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${campaign.resourceId}/leaderboard`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward the pagination parameters', async () => {
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
      const campaign = campaignBuilder().build();
      const campaignRankPage = pageBuilder<CampaignRank>()
        .with('results', [
          campaignRankBuilder().build(),
          campaignRankBuilder().build(),
        ])
        .with('count', 2)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/leaderboard`:
            return Promise.resolve({
              data: rawify(campaignRankPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/campaigns/${campaign.resourceId}/leaderboard?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200)
        .expect({
          count: 2,
          next: null,
          previous: null,
          results: campaignRankPage.results,
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/leaderboard`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward errors from the service', async () => {
      const campaign = campaignBuilder().build();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/leaderboard`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(url),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${campaign.resourceId}/leaderboard`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /community/campaigns/:resourceId/leaderboard/:safeAddress', () => {
    it('should get the campaign rank', async () => {
      const resourceId = faker.string.uuid();
      const campaignRank = campaignRankBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`:
            return Promise.resolve({ data: rawify(campaignRank), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${resourceId}/leaderboard/${safeAddress}`)
        .expect(200)
        .expect(campaignRank);
    });

    it('should validate the Safe address in URL', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${resourceId}/leaderboard/${safeAddress}`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: [],
        });
    });

    it('should validate the response', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const campaignRank = { invalid: 'campaignRank' };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`:
            return Promise.resolve({ data: rawify(campaignRank), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${resourceId}/leaderboard/${safeAddress}`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward an error from the service', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(
                  `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`,
                ),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/campaigns/${resourceId}/leaderboard/${safeAddress}`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /community/eligibility', () => {
    it('should return the eligibility check result', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const eligibility = eligibilityBuilder().build();
      identityApi.checkEligibility.mockResolvedValue(eligibility);

      await request(app.getHttpServer())
        .post(`/v1/community/eligibility`)
        .send(eligibilityRequest)
        .expect(200)
        .expect(eligibility);

      expect(identityApi.checkEligibility).toHaveBeenCalledTimes(1);
      expect(identityApi.checkEligibility).toHaveBeenCalledWith(
        eligibilityRequest,
      );
    });

    it('should return isAllowed:false and isVpn:false if an error occurs during eligibility check', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      identityApi.checkEligibility.mockImplementation(() => {
        throw new Error('identityApi.checkEligibility() runtime error');
      });
      const expected = eligibilityBuilder()
        .with('requestId', eligibilityRequest.requestId)
        .with('isAllowed', false)
        .with('isVpn', false)
        .build();

      await request(app.getHttpServer())
        .post(`/v1/community/eligibility`)
        .send(eligibilityRequest)
        .expect(200)
        .expect(expected);

      expect(identityApi.checkEligibility).toHaveBeenCalledTimes(1);
      expect(identityApi.checkEligibility).toHaveBeenCalledWith(
        eligibilityRequest,
      );
    });
  });

  describe('GET /community/locking/leaderboard', () => {
    it('should get the leaderboard', async () => {
      const leaderboard = pageBuilder()
        .with('results', [lockingRankBuilder().build()])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.resolve({ data: rawify(leaderboard), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/leaderboard`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            count: leaderboard.count,
            next: expect.any(String),
            previous: expect.any(String),
            results: leaderboard.results,
          });
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('should forward the pagination parameters', async () => {
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
      const leaderboard = pageBuilder()
        .with('results', [lockingRankBuilder().build()])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.resolve({ data: rawify(leaderboard), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/locking/leaderboard?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            count: leaderboard.count,
            next: expect.any(String),
            previous: expect.any(String),
            results: leaderboard.results,
          });
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should validate the response', async () => {
      const leaderboard = pageBuilder()
        .with('results', [{ invalid: 'rank' }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.resolve({ data: rawify(leaderboard), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/leaderboard`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward an error from the service', async () => {
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/api/v1/leaderboard`),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/leaderboard`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /community/locking/:safeAddress/rank', () => {
    it('should get the locking rank', async () => {
      const lockingRank = lockingRankBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard/${lockingRank.holder}`:
            return Promise.resolve({ data: rawify(lockingRank), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${lockingRank.holder}/rank`)
        .expect(200)
        .expect(lockingRank);
    });

    it('should validate the Safe address in URL', async () => {
      const safeAddress = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/rank`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: [],
        });
    });

    it('should validate the response', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const lockingRank = { invalid: 'lockingRank' };
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`:
            return Promise.resolve({ data: rawify(lockingRank), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/rank`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward an error from the service', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/rank`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });

  describe('GET /community/locking/:safeAddress/history', () => {
    it('should get locking history', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const lockingHistory = [
        lockEventItemBuilder().build(),
        unlockEventItemBuilder().build(),
        withdrawEventItemBuilder().build(),
      ];
      const lockingHistoryPage = pageBuilder<LockingEvent>()
        .with('results', lockingHistory)
        .with('count', lockingHistory.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          // Service will have checksummed address
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
            return Promise.resolve({
              data: rawify(lockingHistoryPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/history`)
        .expect(200)
        .expect({
          count: lockingHistoryPage.count,
          next: null,
          previous: null,
          results: lockingHistoryPage.results.map(lockingEventToJson),
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('should forward the pagination parameters', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const limit = faker.number.int({ min: 1, max: 10 });
      const offset = faker.number.int({ min: 1, max: 10 });
      const lockingHistory = [
        lockEventItemBuilder().build(),
        unlockEventItemBuilder().build(),
        withdrawEventItemBuilder().build(),
      ];
      const lockingHistoryPage = pageBuilder<LockingEvent>()
        .with('results', lockingHistory)
        .with('count', lockingHistory.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          // Service will have checksummed address
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
            return Promise.resolve({
              data: rawify(lockingHistoryPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(
          `/v1/community/locking/${safeAddress}/history?cursor=limit%3D${limit}%26offset%3D${offset}`,
        )
        .expect(200)
        .expect({
          count: lockingHistoryPage.count,
          next: null,
          previous: null,
          results: lockingHistoryPage.results.map(lockingEventToJson),
        });

      expect(networkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should validate the Safe address in URL', async () => {
      const safeAddress = faker.string.alphanumeric();

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/history`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'Invalid address',
          path: [],
        });
    });

    it('should validate the response', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const invalidLockingHistory = [{ invalid: 'value' }];
      const lockingHistoryPage = pageBuilder()
        .with('results', invalidLockingHistory)
        .with('count', invalidLockingHistory.length)
        .with('previous', null)
        .with('next', null)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          // Service will have checksummed address
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
            return Promise.resolve({
              data: rawify(lockingHistoryPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/history`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('should forward an error from the service', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${lockingBaseUri}/api/v1/all-events/${getAddress(safeAddress)}`:
            return Promise.reject(
              new NetworkResponseError(
                new URL(`${lockingBaseUri}/v1/locking/${safeAddress}/history`),
                {
                  status: statusCode,
                } as Response,
                { message: errorMessage, status: statusCode },
              ),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/community/locking/${safeAddress}/history`)
        .expect(statusCode)
        .expect({
          message: errorMessage,
          code: statusCode,
        });
    });
  });
});
