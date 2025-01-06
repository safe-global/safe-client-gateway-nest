import { SafeApp } from '@/domain/safe-apps/entities/safe-app.entity';
import { Module } from '@nestjs/common';
import { SafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';

export const ISafeAppsRepository = Symbol('ISafeAppsRepository');

export interface ISafeAppsRepository {
  /**
   * Gets the {@link SafeApp[]} associated with the {@link chainId}.
   */
  getSafeApps(args: {
    chainId?: string;
    clientUrl?: string;
    onlyListed?: boolean;
    url?: string;
  }): Promise<Array<SafeApp>>;

  /**
   * Triggers the removal of the safe apps data stored in the DataSource (e.g., cache)
   */
  clearSafeApps(chainId: string): Promise<void>;

  /**
   * Gets the Safe App associated with the chainId and id. If no Safe App is found,
   * null is returned.
   *
   * @param chainId filters Safe Apps that are available on that chain.
   * @param id id of the Safe App to be retrieved.
   * @returns found {@link SafeApp}, or null if not found.
   */
  getSafeAppById(chainId: string, id: number): Promise<SafeApp | null>;
}

@Module({
  imports: [ConfigApiModule],
  providers: [
    {
      provide: ISafeAppsRepository,
      useClass: SafeAppsRepository,
    },
  ],
  exports: [ISafeAppsRepository],
})
export class SafeAppsRepositoryModule {}
