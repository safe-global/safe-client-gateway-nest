import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { SafeApp } from '@/domain/safe-apps/entities/safe-app.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IConfigApi = Symbol('IConfigApi');

export interface IConfigApi {
  getChains(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Chain>>>;

  getChain(chainId: string): Promise<Raw<Chain>>;

  clearChain(chainId: string): Promise<void>;

  getSafeApps(args: {
    chainId?: string;
    clientUrl?: string;
    onlyListed?: boolean;
    url?: string;
  }): Promise<Raw<Array<SafeApp>>>;

  clearSafeApps(chainId: string): Promise<void>;
}
