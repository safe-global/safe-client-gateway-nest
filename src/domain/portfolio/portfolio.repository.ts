import { Inject, Injectable } from '@nestjs/common';
import { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import {
  Portfolio,
  PortfolioSchema,
} from '@/domain/portfolio/entities/portfolio.entity';
import type { IPortfolioRepository } from '@/domain/portfolio/portfolio.repository.interface';

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  constructor(
    @Inject(IPortfolioApi) private readonly portfolioApi: IPortfolioApi,
  ) {}

  public async getPortfolio(safeAddress: `0x${string}`): Promise<Portfolio> {
    const portfolio = await this.portfolioApi.getPortfolio(safeAddress);
    return PortfolioSchema.parse(portfolio);
  }
}
