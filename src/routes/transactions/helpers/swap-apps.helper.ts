import { IConfigurationService } from '@/config/configuration.service.interface';
import { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';
import { Inject, Injectable, Module } from '@nestjs/common';

@Injectable()
export class SwapAppsHelper {
  private readonly restrictApps: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject('SWAP_ALLOWED_APPS') private readonly allowedApps: Set<string>,
  ) {
    this.restrictApps =
      this.configurationService.getOrThrow('swaps.restrictApps');
  }

  /**
   * Checks if the app associated contained in fullAppData is allowed.
   *
   * @param fullAppData - object to which we should verify the app data with
   * @returns true if the app is allowed, false otherwise.
   */
  isAppAllowed({ fullAppData }: FullAppData): boolean {
    if (!this.restrictApps) {
      return true;
    }
    const appCode = fullAppData?.appCode;
    return (
      !!appCode && typeof appCode === 'string' && this.allowedApps.has(appCode)
    );
  }
}

function allowedAppsFactory(
  configurationService: IConfigurationService,
): Set<string> {
  const allowedApps =
    configurationService.getOrThrow<Array<string>>('swaps.allowedApps');
  return new Set(allowedApps);
}

@Module({
  imports: [],
  providers: [
    SwapAppsHelper,
    {
      provide: 'SWAP_ALLOWED_APPS',
      useFactory: allowedAppsFactory,
      inject: [IConfigurationService],
    },
  ],
  exports: [SwapAppsHelper],
})
export class SwapAppsHelperModule {}
