import { Module } from '@nestjs/common';
import { PortfolioRepositoryModule } from '@/domain/portfolio/portfolio.repository.interface';
import { PortfolioController } from '@/routes/portfolio/portfolio.controller';
import { PortfolioMapper } from '@/routes/portfolio/mappers/portfolio.mapper';
import { PortfolioService } from '@/routes/portfolio/portfolio.service';

@Module({
  imports: [PortfolioRepositoryModule],
  controllers: [PortfolioController],
  providers: [PortfolioMapper, PortfolioService],
})
export class PortfolioModule {}
