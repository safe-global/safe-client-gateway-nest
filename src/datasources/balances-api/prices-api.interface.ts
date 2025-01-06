import type { AssetPrice } from '@/datasources/balances-api/entities/asset-price.entity';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IPricesApi = Symbol('IPricesApi');

export interface IPricesApi {
  getNativeCoinPrice(args: {
    chain: Chain;
    fiatCode: string;
  }): Promise<number | null>;

  getTokenPrices(args: {
    chain: Chain;
    tokenAddresses: Array<string>;
    fiatCode: string;
  }): Promise<Raw<Array<AssetPrice>>>;

  getFiatCodes(): Promise<Raw<Array<string>>>;
}
