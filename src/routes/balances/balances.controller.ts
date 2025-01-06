import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BalancesService } from '@/routes/balances/balances.service';
import { Balances } from '@/routes/balances/entities/balances.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('balances')
@Controller({
  path: '',
  version: '1',
})
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @ApiOkResponse({ type: Balances })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  @ApiQuery({ name: 'exclude_spam', required: false, type: Boolean })
  @Get('chains/:chainId/safes/:safeAddress/balances/:fiatCode')
  async getBalances(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('fiatCode') fiatCode: string,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
  ): Promise<Balances> {
    return this.balancesService.getBalances({
      chainId,
      safeAddress,
      fiatCode,
      trusted,
      excludeSpam,
    });
  }

  @Get('balances/supported-fiat-codes')
  async getSupportedFiatCodes(): Promise<Array<string>> {
    return this.balancesService.getSupportedFiatCodes();
  }
}
