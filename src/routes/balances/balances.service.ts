import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { Balance as DomainBalance } from '@/domain/balances/entities/balance.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { Balance } from '@/routes/balances/entities/balance.entity';
import { Balances } from '@/routes/balances/entities/balances.entity';
import { TokenType } from '@/routes/balances/entities/token-type.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { orderBy } from 'lodash';
import { IPricesRepository } from '@/domain/prices/prices.repository.interface';
import { getNumberString } from '@/domain/common/utils/utils';

@Injectable()
export class BalancesService {
  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IPricesRepository)
    private readonly pricesRepository: IPricesRepository,
  ) {}

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Balances> {
    const { chainId } = args;
    const domainBalances = await this.balancesRepository.getBalances(args);
    const { nativeCurrency } = await this.chainsRepository.getChain(chainId);
    const balances: Balance[] = await Promise.all(
      domainBalances.map(async (b) => this._mapBalance(b, nativeCurrency)),
    );
    const fiatTotal = balances
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => acc + Number(b.fiatBalance), 0);

    return {
      fiatTotal: getNumberString(fiatTotal),
      items: orderBy(balances, (b) => Number(b.fiatBalance), 'desc'),
    };
  }

  private async _mapBalance(
    balance: DomainBalance,
    nativeCurrency: NativeCurrency,
  ): Promise<Balance> {
    const tokenAddress = balance.tokenAddress;
    const tokenType =
      tokenAddress === null ? TokenType.NativeToken : TokenType.Erc20;

    const tokenMetaData =
      tokenAddress === null
        ? {
            decimals: nativeCurrency.decimals,
            symbol: nativeCurrency.symbol,
            name: nativeCurrency.name,
            logoUri: nativeCurrency.logoUri,
          }
        : {
            decimals: balance.token.decimals,
            symbol: balance.token.symbol,
            name: balance.token.name,
            logoUri: balance.token.logoUri,
          };

    return {
      tokenInfo: {
        type: tokenType,
        address: tokenAddress ?? NULL_ADDRESS,
        ...tokenMetaData,
      },
      balance: balance.balance,
      fiatBalance: balance.fiatBalance ?? '0',
      fiatConversion: balance.fiatConversion ?? '0',
    };
  }

  async getSupportedFiatCodes(): Promise<string[]> {
    return this.pricesRepository.getFiatCodes();
  }
}
