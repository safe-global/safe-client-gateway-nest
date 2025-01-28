import { Module } from '@nestjs/common';
import { PortfolioApiModule } from '@/datasources/portfolio-api/portfolio-api.module';
import { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import { PortfolioRepository } from '@/domain/portfolio/portfolio.repository';

export const IPortfolioRepository = Symbol('IPortfolioRepository');

export interface IPortfolioRepository {
  getPortfolio(safeAddress: `0x${string}`): Promise<Portfolio>;
}

@Module({
  imports: [PortfolioApiModule],
  providers: [
    {
      provide: IPortfolioRepository,
      useClass: PortfolioRepository,
    },
  ],
  exports: [IPortfolioRepository],
})
export class PortfolioRepositoryModule {}
