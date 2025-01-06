import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { Page } from '@/domain/entities/page.entity';
import { ILockingApi } from '@/domain/interfaces/locking-api.interface';
import { Campaign } from '@/domain/community/entities/campaign.entity';
import { CampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import { CampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { LockingEvent } from '@/domain/community/entities/locking-event.entity';
import { LockingRank } from '@/domain/community/entities/locking-rank.entity';
import { Inject } from '@nestjs/common';
import type { Raw } from '@/validation/entities/raw.entity';

export class LockingApi implements ILockingApi {
  private readonly baseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('locking.baseUri');
  }

  async getCampaignById(resourceId: string): Promise<Raw<Campaign>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${resourceId}`;
      const { data } = await this.networkService.get<Campaign>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaigns(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Campaign>>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns`;
      const { data } = await this.networkService.get<Page<Campaign>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaignActivities(args: {
    resourceId: string;
    holder?: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignActivity>>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${args.resourceId}/activities`;
      const { data } = await this.networkService.get<
        Raw<Page<CampaignActivity>>
      >({
        url,
        networkRequest: {
          params: {
            holder: args.holder,
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaignRank(args: {
    resourceId: string;
    safeAddress: `0x${string}`;
  }): Promise<Raw<CampaignRank>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${args.resourceId}/leaderboard/${args.safeAddress}`;
      const { data } = await this.networkService.get<CampaignRank>({
        url,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLockingRank(safeAddress: `0x${string}`): Promise<Raw<LockingRank>> {
    try {
      const url = `${this.baseUri}/api/v1/leaderboard/${safeAddress}`;
      const { data } = await this.networkService.get<LockingRank>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLeaderboard(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingRank>>> {
    try {
      const url = `${this.baseUri}/api/v1/leaderboard`;
      const { data } = await this.networkService.get<Page<LockingRank>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCampaignLeaderboard(args: {
    resourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<CampaignRank>>> {
    try {
      const url = `${this.baseUri}/api/v1/campaigns/${args.resourceId}/leaderboard`;
      const { data } = await this.networkService.get<Page<CampaignRank>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getLockingHistory(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<LockingEvent>>> {
    try {
      const url = `${this.baseUri}/api/v1/all-events/${args.safeAddress}`;
      const { data } = await this.networkService.get<Page<LockingEvent>>({
        url,
        networkRequest: {
          params: {
            limit: args.limit,
            offset: args.offset,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
