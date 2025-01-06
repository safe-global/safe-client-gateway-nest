import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import type { Raw } from '@/validation/entities/raw.entity';

export const IBalancesApiManager = Symbol('IBalancesApiManager');

export interface IBalancesApiManager extends IApiManager<IBalancesApi> {
  /**
   * Gets an {@link IBalancesApi} implementation.
   * Each chain is associated with an implementation (i.e.: to a balances
   * provider) via configuration.
   *
   * Note: if the Safe entity associated with the safeAddress cannot be retrieved
   * from the TransactionApi for the chainId, then the ZerionApi will be used.
   *
   * @param chainId - the chain identifier to check.
   * @param safeAddress - the Safe address to check.
   * @returns {@link IBalancesApi} configured for the input chain ID.
   */
  getApi(chainId: string, safeAddress: `0x${string}`): Promise<IBalancesApi>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<Raw<Array<string>>>;
}
