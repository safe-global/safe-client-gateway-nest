import type { Balance } from '@/domain/balances/entities/balance.entity';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export interface IBalancesApi {
  getBalances(args: {
    safeAddress: `0x${string}`;
    fiatCode: string;
    chain: Chain;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Raw<Array<Balance>>>;

  clearBalances(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  getCollectibles(args: {
    safeAddress: `0x${string}`;
    chain: Chain;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Raw<Page<Collectible>>>;

  clearCollectibles(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  getFiatCodes(): Promise<Raw<Array<string>>>;
}
