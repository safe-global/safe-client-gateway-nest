import type { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import type { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import type { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import type { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import type { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import type { Stake } from '@/datasources/staking-api/entities/stake.entity';
import type { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IStakingApi = Symbol('IStakingApi');

export interface IStakingApi {
  getDeployments(): Promise<Raw<Array<Deployment>>>;

  getNetworkStats(): Promise<Raw<NetworkStats>>;

  getDedicatedStakingStats(): Promise<Raw<DedicatedStakingStats>>;

  getPooledStakingStats(pool: `0x${string}`): Promise<Raw<PooledStakingStats>>;

  getDefiVaultStats(vault: `0x${string}`): Promise<Raw<Array<DefiVaultStats>>>;

  getStakes(args: {
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): Promise<Raw<Array<Stake>>>;

  clearStakes(safeAddress: `0x${string}`): Promise<void>;

  getTransactionStatus(txHash: `0x${string}`): Promise<Raw<TransactionStatus>>;
}
