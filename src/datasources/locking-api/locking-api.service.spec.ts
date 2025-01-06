import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { LockingApi } from '@/datasources/locking-api/locking-api.service';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  lockEventItemBuilder,
  unlockEventItemBuilder,
  withdrawEventItemBuilder,
} from '@/domain/community/entities/__tests__/locking-event.builder';
import { getAddress } from 'viem';
import { lockingRankBuilder } from '@/domain/community/entities/__tests__/locking-rank.builder';
import { campaignBuilder } from '@/domain/community/entities/__tests__/campaign.builder';
import { campaignRankBuilder } from '@/domain/community/entities/__tests__/campaign-rank.builder';
import type { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { campaignActivityBuilder } from '@/domain/community/entities/__tests__/campaign-activity.builder';
import { rawify } from '@/validation/entities/raw.entity';

const networkService = {
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;
const mockNetworkService = jest.mocked(networkService);

describe('LockingApi', () => {
  let service: LockingApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;

  let lockingBaseUri: string;

  beforeEach(() => {
    jest.resetAllMocks();

    lockingBaseUri = faker.internet.url({ appendSlash: false });

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('locking.baseUri', lockingBaseUri);

    httpErrorFactory = new HttpErrorFactory();

    service = new LockingApi(
      fakeConfigurationService,
      mockNetworkService,
      httpErrorFactory,
    );
  });

  describe('getCampaignById', () => {
    it('should get a campaign by resourceId', async () => {
      const campaign = campaignBuilder().build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaign),
        status: 200,
      });

      const result = await service.getCampaignById(campaign.resourceId);

      expect(result).toEqual(campaign);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}`,
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const campaign = campaignBuilder().build();
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignById(campaign.resourceId),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCampaigns', () => {
    it('should get campaigns', async () => {
      const campaignsPage = pageBuilder()
        .with('results', [campaignBuilder().build(), campaignBuilder().build()])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignsPage),
        status: 200,
      });

      const result = await service.getCampaigns({});

      expect(result).toEqual(campaignsPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const campaignsPage = pageBuilder()
        .with('results', [campaignBuilder().build(), campaignBuilder().build()])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignsPage),
        status: 200,
      });

      await service.getCampaigns({ limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getCampaigns({})).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCampaignActivities', () => {
    it('should get campaigns activities', async () => {
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const campaignActivityPage = pageBuilder()
        .with('results', [
          campaignActivityBuilder().with('holder', holder).build(),
          campaignActivityBuilder().with('holder', holder).build(),
        ])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignActivityPage),
        status: 200,
      });

      const result = await service.getCampaignActivities({
        resourceId: campaign.resourceId,
        holder,
      });

      expect(result).toEqual(campaignActivityPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`,
        networkRequest: {
          params: {
            holder: holder,
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should get campaigns activities for address', async () => {
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const campaignActivityPage = pageBuilder()
        .with('results', [
          campaignActivityBuilder().with('holder', holder).build(),
          campaignActivityBuilder().with('holder', holder).build(),
        ])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignActivityPage),
        status: 200,
      });

      const result = await service.getCampaignActivities({
        resourceId: campaign.resourceId,
        holder,
      });

      expect(result).toEqual(campaignActivityPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`,
        networkRequest: {
          params: {
            holder,
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const campaignActivityPage = pageBuilder()
        .with('results', [
          campaignActivityBuilder().with('holder', holder).build(),
          campaignActivityBuilder().with('holder', holder).build(),
        ])
        .build();

      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignActivityPage),
        status: 200,
      });

      await service.getCampaignActivities({
        resourceId: campaign.resourceId,
        holder,
        limit,
        offset,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities`,
        networkRequest: {
          params: {
            holder,
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const campaign = campaignBuilder().build();
      const holder = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${lockingBaseUri}/api/v1/campaigns/${campaign.resourceId}/activities/${holder}`,
        ),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignActivities({
          resourceId: campaign.resourceId,
          holder,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCampaignRank', () => {
    it('should get campaign rank', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const campaignRank = campaignRankBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignRank),
        status: 200,
      });

      const result = await service.getCampaignRank({ resourceId, safeAddress });

      expect(result).toEqual(campaignRank);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`,
      });
    });

    it('should forward error', async () => {
      const resourceId = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard/${safeAddress}`,
        ),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignRank({ resourceId, safeAddress }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLockingRank', () => {
    it('should get locking rank', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const lockingRank = lockingRankBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(lockingRank),
        status: 200,
      });

      const result = await service.getLockingRank(safeAddress);

      expect(result).toEqual(lockingRank);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`,
      });
    });

    it('should forward error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/leaderboard/${safeAddress}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getLockingRank(safeAddress)).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLeaderboard', () => {
    it('should get leaderboard', async () => {
      const leaderboardPage = pageBuilder()
        .with('results', [lockingRankBuilder().build()])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(leaderboardPage),
        status: 200,
      });

      const result = await service.getLeaderboard({});

      expect(result).toEqual(leaderboardPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const leaderboardPage = pageBuilder()
        .with('results', [lockingRankBuilder().build()])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(leaderboardPage),
        status: 200,
      });

      await service.getLeaderboard({ limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/leaderboard`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/leaderboard`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getLeaderboard({})).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCampaignLeaderboard', () => {
    it('should get leaderboard by campaign', async () => {
      const resourceId = faker.string.uuid();
      const campaignRankPage = pageBuilder<CampaignRank>()
        .with('results', [
          campaignRankBuilder().build(),
          campaignRankBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignRankPage),
        status: 200,
      });

      const result = await service.getCampaignLeaderboard({ resourceId });

      expect(result).toEqual(campaignRankPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const resourceId = faker.string.uuid();
      const campaignRankPage = pageBuilder<CampaignRank>()
        .with('results', [
          campaignRankBuilder().build(),
          campaignRankBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(campaignRankPage),
        status: 200,
      });

      await service.getCampaignLeaderboard({ resourceId, limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const resourceId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/campaigns/${resourceId}/leaderboard`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        service.getCampaignLeaderboard({ resourceId }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLockingHistory', () => {
    it('should get locking history', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const lockingHistoryPage = pageBuilder()
        .with('results', [
          lockEventItemBuilder().build(),
          unlockEventItemBuilder().build(),
          withdrawEventItemBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(lockingHistoryPage),
        status: 200,
      });

      await service.getLockingHistory({ safeAddress });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${safeAddress}`,
        networkRequest: {
          params: {
            limit: undefined,
            offset: undefined,
          },
        },
      });
    });

    it('should forward pagination queries', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const limit = faker.number.int();
      const offset = faker.number.int();
      const lockingHistoryPage = pageBuilder()
        .with('results', [
          lockEventItemBuilder().build(),
          unlockEventItemBuilder().build(),
          withdrawEventItemBuilder().build(),
        ])
        .build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(lockingHistoryPage),
        status: 200,
      });

      await service.getLockingHistory({ safeAddress, limit, offset });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${lockingBaseUri}/api/v1/all-events/${safeAddress}`,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    it('should forward error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${lockingBaseUri}/api/v1/all-events/${safeAddress}`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(service.getLockingHistory({ safeAddress })).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });
});
