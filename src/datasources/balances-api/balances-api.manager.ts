import { IConfigurationService } from '@/config/configuration.service.interface';
import { SafeBalancesApi } from '@/datasources/balances-api/safe-balances-api.service';
import { IZerionBalancesApi } from '@/datasources/balances-api/zerion-balances-api.service';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IPricesApi } from '@/datasources/balances-api/prices-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import intersection from 'lodash/intersection';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { z } from 'zod';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

@Injectable()
export class BalancesApiManager implements IBalancesApiManager {
  private safeBalancesApiMap: Record<string, SafeBalancesApi> = {};
  private readonly isCounterFactualBalancesEnabled: boolean;
  private readonly zerionChainIds: Array<string>;
  private readonly zerionBalancesApi: IBalancesApi;
  private readonly useVpcUrl: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(IZerionBalancesApi) zerionBalancesApi: IBalancesApi,
    @Inject(IPricesApi) private readonly coingeckoApi: IPricesApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {
    this.isCounterFactualBalancesEnabled =
      this.configurationService.getOrThrow<boolean>(
        'features.counterfactualBalances',
      );
    this.zerionChainIds = this.configurationService.getOrThrow<Array<string>>(
      'features.zerionBalancesChainIds',
    );
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
    this.zerionBalancesApi = zerionBalancesApi;
  }

  async getApi(
    chainId: string,
    safeAddress: `0x${string}`,
  ): Promise<IBalancesApi> {
    if (this.zerionChainIds.includes(chainId)) {
      return this.zerionBalancesApi;
    }
    const transactionApi = await this.transactionApiManager.getApi(chainId);

    if (!this.isCounterFactualBalancesEnabled) {
      return this._getSafeBalancesApi(chainId);
    }

    // SafeBalancesApi will be returned only if TransactionApi returns the Safe data.
    // Otherwise ZerionBalancesApi will be returned as the Safe is considered counterfactual/not deployed.
    const isSafe = await transactionApi.isSafe(safeAddress);
    if (isSafe) {
      return this._getSafeBalancesApi(chainId);
    } else {
      return this.zerionBalancesApi;
    }
  }

  async getFiatCodes(): Promise<Raw<Array<string>>> {
    const [zerionFiatCodes, safeFiatCodes] = await Promise.all([
      this.zerionBalancesApi.getFiatCodes(),
      this.coingeckoApi.getFiatCodes(),
    ]).then(z.array(z.array(z.string())).parse);
    return rawify(intersection(zerionFiatCodes, safeFiatCodes).sort());
  }

  private async _getSafeBalancesApi(chainId: string): Promise<SafeBalancesApi> {
    const safeBalancesApi = this.safeBalancesApiMap[chainId];
    if (safeBalancesApi !== undefined) return safeBalancesApi;

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);
    this.safeBalancesApiMap[chainId] = new SafeBalancesApi(
      chainId,
      this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
      this.dataSource,
      this.cacheService,
      this.configurationService,
      this.httpErrorFactory,
      this.coingeckoApi,
    );
    return this.safeBalancesApiMap[chainId];
  }

  destroyApi(chainId: string): void {
    if (this.safeBalancesApiMap[chainId] !== undefined) {
      delete this.safeBalancesApiMap[chainId];
    }
  }
}
