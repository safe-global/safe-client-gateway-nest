import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param } from '@nestjs/common';
import { SafeState } from '@/routes/safes/entities/safe-info.entity';
import { SafesService } from '@/routes/safes/safes.service';
import { SafeNonces } from '@/routes/safes/entities/nonces.entity';

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
    @Param('safeAddress') safeAddress: string,
  ): Promise<SafeState> {
    return this.service.getSafeInfo({ chainId, safeAddress });
  }

  @ApiOkResponse({ type: SafeNonces })
  @Get('chains/:chainId/safes/:safeAddress/nonces')
  async getNonces(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
  ): Promise<SafeNonces> {
    return this.service.getNonces({ chainId, safeAddress });
  }
}
