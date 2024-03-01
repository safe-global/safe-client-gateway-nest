import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { BalancesValidator } from '@/domain/balances/balances.validator';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IPricesRepository } from '@/domain/prices/prices.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { getNumberString } from '@/domain/common/utils/utils';
import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IPricesRepository)
    private readonly pricesRepository: IPricesRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly balancesValidator: BalancesValidator,
  ) {}

  async getBalances(args: {
    chainId: string;
    safeAddress: string;
    fiatCode: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]> {
    const { chainId, safeAddress, fiatCode, trusted, excludeSpam } = args;
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const balances = await api.getBalances({
      safeAddress,
      trusted,
      excludeSpam,
    });
    balances.map((balance) => this.balancesValidator.validate(balance));

    const tokenAddresses = balances
      .map((balance) => balance.tokenAddress)
      .filter((address): address is string => address !== null);

    const prices = tokenAddresses.length
      ? await this._getTokenPrices(chainId, fiatCode, tokenAddresses)
      : [];

    return await Promise.all(
      balances.map(async (balance) => {
        const tokenAddress = balance.tokenAddress?.toLowerCase() ?? null;
        let price: number | null;
        if (tokenAddress === null) {
          price = await this._getNativeCoinPrice(chainId, fiatCode);
        } else {
          const found = prices.find((assetPrice) => assetPrice[tokenAddress]);
          price = found?.[tokenAddress]?.[fiatCode.toLowerCase()] ?? null;
        }
        const fiatBalance = await this._getFiatBalance(price, balance);
        return {
          ...balance,
          fiatBalance: fiatBalance ? getNumberString(fiatBalance) : null,
          fiatConversion: price ? getNumberString(price) : null,
        };
      }),
    );
  }

  async clearLocalBalances(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    await api.clearLocalBalances(args.safeAddress);
  }

  private async _getNativeCoinPrice(
    chainId: string,
    fiatCode: string,
  ): Promise<number | null> {
    const nativeCoinId = this.configurationService.getOrThrow<string>(
      `prices.chains.${chainId}.nativeCoin`,
    );
    try {
      return await this.pricesRepository.getNativeCoinPrice({
        nativeCoinId,
        fiatCode,
      });
    } catch (err) {
      this.loggingService.warn({
        type: 'invalid_native_coin_price',
        native_coin_id: nativeCoinId,
        fiat_code: fiatCode,
      });
      return null;
    }
  }

  private async _getTokenPrices(
    chainId: string,
    fiatCode: string,
    tokenAddresses: string[],
  ): Promise<AssetPrice[]> {
    const chainName = this.configurationService.getOrThrow<string>(
      `prices.chains.${chainId}.chainName`,
    );
    try {
      return await this.pricesRepository.getTokenPrices({
        chainName,
        tokenAddresses,
        fiatCode,
      });
    } catch (err) {
      this.loggingService.warn({
        type: 'invalid_token_price',
        token_address: tokenAddresses,
        fiat_code: fiatCode,
      });
      return [];
    }
  }

  private _getFiatBalance(
    price: number | null,
    balance: Balance,
  ): number | null {
    return price !== null
      ? (price * Number(balance.balance)) /
          10 ** (balance.token?.decimals ?? 18)
      : null;
  }
}
