import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IBackboneRepository } from '@/domain/backbone/backbone.repository.interface';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { MasterCopy } from '@/routes/chains/entities/master-copy.entity';
import { Page } from '@/domain/entities/page.entity';
import { AboutChain } from '@/routes/chains/entities/about-chain.entity';
import { Chain } from '@/routes/chains/entities/chain.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { IndexingStatus } from '@/routes/chains/entities/indexing-status.entity';

@Injectable()
export class ChainsService {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IBackboneRepository)
    private readonly backboneRepository: IBackboneRepository,
  ) {}

  async getChains(
    routeUrl: Readonly<URL>,
    paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    const result = await this.chainsRepository.getChains(
      paginationData.limit,
      paginationData.offset,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, result.next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, result.previous);

    const chains = result.results.map((chain) => {
      return new Chain(chain);
    });

    return {
      count: result.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: chains,
    };
  }

  async getChain(chainId: string): Promise<Chain> {
    const result = await this.chainsRepository.getChain(chainId);
    return new Chain(result);
  }

  async getAboutChain(chainId: string): Promise<AboutChain> {
    const chain = await this.chainsRepository.getChain(chainId);

    return new AboutChain(
      chain.transactionService,
      this.configurationService.getOrThrow<string>('about.name'),
      this.configurationService.getOrThrow<string>('about.version'),
      this.configurationService.getOrThrow<string>('about.buildNumber'),
    );
  }

  async getBackbone(chainId: string): Promise<Backbone> {
    return this.backboneRepository.getBackbone(chainId);
  }

  async getMasterCopies(chainId: string): Promise<Array<MasterCopy>> {
    const result = await this.chainsRepository.getSingletons(chainId);

    return result.map((singleton) => ({
      address: singleton.address,
      version: singleton.version,
    }));
  }

  async getIndexingStatus(chainId: string): Promise<IndexingStatus> {
    const indexingStatus =
      await this.chainsRepository.getIndexingStatus(chainId);

    const lastSync = Math.min(
      indexingStatus.erc20BlockTimestamp.getTime(),
      indexingStatus.masterCopiesBlockTimestamp.getTime(),
    );

    return new IndexingStatus({
      lastSync,
      synced: indexingStatus.synced,
    });
  }
}
