import { Balance } from '@/domain/balances/entities/balance.entity';
import { Module } from '@nestjs/common';
import { BalancesRepository } from '@/domain/balances/balances.repository';
import { BalancesApiModule } from '@/datasources/balances-api/balances-api.module';
import { Chain } from '@/domain/chains/entities/chain.entity';

export const IBalancesRepository = Symbol('IBalancesRepository');

export interface IBalancesRepository {
  /**
   * Gets the collection of {@link Balance} associated with {@link safeAddress}
   * on {@link chainId}
   */
  getBalances(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Array<Balance>>;

  /**
   * Clears any stored local balance data of {@link safeAddress} on {@link chainId}
   */
  clearBalances(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<Array<string>>;

  /**
   * Clears the API associated with {@link chainId}
   */
  clearApi(chainId: string): void;
}

@Module({
  imports: [BalancesApiModule],
  providers: [
    {
      provide: IBalancesRepository,
      useClass: BalancesRepository,
    },
  ],
  exports: [IBalancesRepository],
})
export class BalancesRepositoryModule {}
