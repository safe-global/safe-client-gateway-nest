import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SafeApp } from '@/routes/safe-apps/entities/safe-app.entity';
import { SafeAppsService } from '@/routes/safe-apps/safe-apps.service';

@ApiTags('safe-apps')
@Controller({
  path: '',
  version: '1',
})
export class SafeAppsController {
  constructor(private readonly safeAppsService: SafeAppsService) {}

  @ApiOkResponse({ type: SafeApp, isArray: true })
  @Get('chains/:chainId/safe-apps')
  @ApiQuery({ name: 'clientUrl', required: false, type: String })
  @ApiQuery({ name: 'url', required: false, type: String })
  async getSafeApps(
    @Param('chainId') chainId: string,
    @Query('clientUrl') clientUrl?: string,
    @Query('url') url?: string,
  ): Promise<Array<SafeApp>> {
    return this.safeAppsService.getSafeApps({ chainId, clientUrl, url });
  }
}
