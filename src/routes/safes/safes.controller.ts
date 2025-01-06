import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
import { SafeState } from '@/routes/safes/entities/safe-info.entity';
import { SafesService } from '@/routes/safes/safes.service';
import { SafeNonces } from '@/routes/safes/entities/nonces.entity';
import { SafeOverview } from '@/routes/safes/entities/safe-overview.entity';
import {
  Caip10AddressesSchema,
  type Caip10Addresses,
} from '@/routes/safes/entities/caip-10-addresses.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

@ApiTags('safes')
@Controller({
  version: '1',
})
export class SafesController {
  constructor(private readonly service: SafesService) {}

  @ApiOkResponse({ type: SafeState })
  @Get('chains/:chainId/safes/:safeAddress')
  async getSafe(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<SafeState> {
    return this.service.getSafeInfo({ chainId, safeAddress });
  }

  @ApiOkResponse({ type: SafeNonces })
  @Get('chains/:chainId/safes/:safeAddress/nonces')
  async getNonces(
    @Param('chainId') chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<SafeNonces> {
    return this.service.getNonces({ chainId, safeAddress });
  }

  @ApiQuery({ name: 'wallet_address', required: false, type: String })
  @ApiQuery({ name: 'currency', required: true, type: String })
  @ApiQuery({ name: 'safes', required: true, type: String })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  @ApiQuery({ name: 'exclude_spam', required: false, type: Boolean })
  @Get('safes')
  @ApiOkResponse({ type: SafeOverview, isArray: true })
  async getSafeOverview(
    @Query('currency') currency: string,
    @Query('safes', new ValidationPipe(Caip10AddressesSchema))
    addresses: Caip10Addresses,
    @Query('trusted', new DefaultValuePipe(false), ParseBoolPipe)
    trusted: boolean,
    @Query('exclude_spam', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSpam: boolean,
    @Query('wallet_address', new ValidationPipe(AddressSchema.optional()))
    walletAddress?: `0x${string}`,
  ): Promise<Array<SafeOverview>> {
    return this.service.getSafeOverview({
      currency,
      addresses,
      trusted,
      excludeSpam,
      walletAddress,
    });
  }
}
