import { Inject, Injectable } from '@nestjs/common';
import { SafeAppAccessControlPolicies } from '@/domain/safe-apps/entities/safe-app-access-control.entity';
import { SafeApp as DomainSafeApp } from '@/domain/safe-apps/entities/safe-app.entity';
import { SafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { SafeApp } from '@/routes/safe-apps/entities/safe-app.entity';
import { SafeAppAccessControl } from '@/routes/safe-apps/entities/safe-app-access-control.entity';

@Injectable()
export class SafeAppsService {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
  ) {}

  async getSafeApps(args: {
    chainId: string;
    clientUrl?: string;
    url?: string;
  }): Promise<SafeApp[]> {
    const result = await this.safeAppsRepository.getSafeApps(args);

    return result.map(
      (safeApp) =>
        new SafeApp(
          safeApp.id,
          safeApp.url,
          safeApp.name,
          safeApp.iconUrl,
          safeApp.description,
          safeApp.chainIds.map((chainId) => chainId.toString()),
          safeApp.provider,
          this._parseAccessControl(safeApp),
          safeApp.tags,
          safeApp.features,
          safeApp.developerWebsite,
          safeApp.socialProfiles,
        ),
    );
  }

  private _parseAccessControl(
    domainSafeApp: DomainSafeApp,
  ): SafeAppAccessControl {
    switch (domainSafeApp.accessControl.type) {
      case SafeAppAccessControlPolicies.NoRestrictions:
        return {
          type: SafeAppAccessControlPolicies.NoRestrictions,
          value: domainSafeApp.accessControl.value,
        };
      case SafeAppAccessControlPolicies.DomainAllowlist:
        return {
          type: SafeAppAccessControlPolicies.DomainAllowlist,
          value: domainSafeApp.accessControl.value,
        };
      default:
        return {
          type: SafeAppAccessControlPolicies.Unknown,
          value: domainSafeApp.accessControl.value,
        };
    }
  }
}
