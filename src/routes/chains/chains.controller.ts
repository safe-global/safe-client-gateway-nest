import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChainsService } from '@/routes/chains/chains.service';
import { AboutChain } from '@/routes/chains/entities/about-chain.entity';
import { ChainPage } from '@/routes/chains/entities/chain-page.entity';
import { Chain } from '@/routes/chains/entities/chain.entity';
import { MasterCopy } from '@/routes/chains/entities/master-copy.entity';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import {
  Backbone as ApiBackbone,
  Backbone,
} from '@/routes/chains/entities/backbone.entity';
import { IndexingStatus } from '@/routes/chains/entities/indexing-status.entity';

@ApiTags('chains')
@Controller({
  path: 'chains',
  version: '1',
})
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}

  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiOkResponse({ type: ChainPage })
  @Get()
  async getChains(
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    return this.chainsService.getChains(routeUrl, paginationData);
  }

  @ApiOkResponse({ type: Chain })
  @Get('/:chainId')
  async getChain(@Param('chainId') chainId: string): Promise<Chain> {
    return this.chainsService.getChain(chainId);
  }

  @ApiOkResponse({ type: AboutChain })
  @Get('/:chainId/about')
  async getAboutChain(@Param('chainId') chainId: string): Promise<AboutChain> {
    return this.chainsService.getAboutChain(chainId);
  }

  @ApiOkResponse({ type: ApiBackbone })
  @Get('/:chainId/about/backbone')
  async getBackbone(@Param('chainId') chainId: string): Promise<Backbone> {
    return this.chainsService.getBackbone(chainId);
  }

  @ApiOkResponse({ type: MasterCopy, isArray: true })
  @Get('/:chainId/about/master-copies')
  async getMasterCopies(
    @Param('chainId') chainId: string,
  ): Promise<Array<MasterCopy>> {
    return this.chainsService.getMasterCopies(chainId);
  }

  @ApiOkResponse({ type: IndexingStatus })
  @Get('/:chainId/about/indexing')
  async getIndexingStatus(
    @Param('chainId') chainId: string,
  ): Promise<IndexingStatus> {
    return this.chainsService.getIndexingStatus(chainId);
  }
}
