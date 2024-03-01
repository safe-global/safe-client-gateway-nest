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

    const chains = result.results.map(
      (chain) =>
        new Chain(
          chain.chainId,
          chain.chainName,
          chain.description,
          chain.l2,
          chain.nativeCurrency,
          chain.transactionService,
          chain.blockExplorerUriTemplate,
          chain.disabledWallets,
          chain.features,
          chain.gasPrice,
          chain.publicRpcUri,
          chain.rpcUri,
          chain.safeAppsRpcUri,
          chain.shortName,
          chain.theme,
          chain.ensRegistryAddress,
        ),
    );

    return {
      count: result.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: chains,
    };
  }

  async getChain(chainId: string): Promise<Chain> {
    const result = await this.chainsRepository.getChain(chainId);
    return new Chain(
      result.chainId,
      result.chainName,
      result.description,
      result.l2,
      result.nativeCurrency,
      result.transactionService,
      result.blockExplorerUriTemplate,
      result.disabledWallets,
      result.features,
      result.gasPrice,
      result.publicRpcUri,
      result.rpcUri,
      result.safeAppsRpcUri,
      result.shortName,
      result.theme,
      result.ensRegistryAddress,
    );
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

  async getMasterCopies(chainId: string): Promise<MasterCopy[]> {
    const result = await this.chainsRepository.getMasterCopies(chainId);

    return result.map((masterCopy) => ({
      address: masterCopy.address,
      version: masterCopy.version,
    }));
  }
}
