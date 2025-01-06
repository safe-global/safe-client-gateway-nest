import type { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import type { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import type { Account } from '@/domain/accounts/entities/account.entity';

export const ICounterfactualSafesDatasource = Symbol(
  'ICounterfactualSafesDatasource',
);

export interface ICounterfactualSafesDatasource {
  createCounterfactualSafe(args: {
    account: Account;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafe(args: {
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafesForAddress(
    address: `0x${string}`,
  ): Promise<Array<CounterfactualSafe>>;

  deleteCounterfactualSafe(args: {
    account: Account;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<void>;

  deleteCounterfactualSafesForAccount(account: Account): Promise<void>;
}
