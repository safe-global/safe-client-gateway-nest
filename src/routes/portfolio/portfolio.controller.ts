import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import type { PortfolioItemPage } from '@/routes/portfolio/entities/portfolio-item-page.entity';

@ApiTags('portfolio')
@Controller({
  path: '',
  version: '1',
})
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('chains/:chainId/safes/:safeAddress/portfolio')
  public async getPortfolio(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<PortfolioItemPage> {
    return this.portfolioService.getPortfolio({ chainId, safeAddress });
  }
}
