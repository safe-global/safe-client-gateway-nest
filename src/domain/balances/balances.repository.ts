import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import {
  Balance,
  BalancesSchema,
} from '@/domain/balances/entities/balance.entity';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { z } from 'zod';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
  ) {}

  async getBalances(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Array<Balance>> {
    const api = await this.balancesApiManager.getApi(
      args.chain.chainId,
      args.safeAddress,
    );
    const balances = await api.getBalances(args);
    return BalancesSchema.parse(balances);
  }

  async clearBalances(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const api = await this.balancesApiManager.getApi(
      args.chainId,
      args.safeAddress,
    );
    await api.clearBalances(args);
  }

  async getFiatCodes(): Promise<Array<string>> {
    return this.balancesApiManager
      .getFiatCodes()
      .then(z.array(z.string()).parse);
  }

  clearApi(chainId: string): void {
    this.balancesApiManager.destroyApi(chainId);
  }
}
