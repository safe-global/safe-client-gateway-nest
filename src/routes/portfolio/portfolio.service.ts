import { Inject, Injectable } from '@nestjs/common';
import { IPortfolioRepository } from '@/domain/portfolio/portfolio.repository.interface';
import { PortfolioMapper } from '@/routes/portfolio/mappers/portfolio.mapper';
import type { PortfolioItemPage } from '@/routes/portfolio/entities/portfolio-item-page.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(IPortfolioRepository)
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly portfolioMapper: PortfolioMapper,
  ) {}

  public async getPortfolio(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<PortfolioItemPage> {
    const portfolio = await this.portfolioRepository.getPortfolio(
      args.safeAddress,
    );
    return this.portfolioMapper.mapChainPortfolio({
      chainId: args.chainId,
      portfolio,
    });
  }
}
