import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';

export const IPricesRepository = Symbol('IPricesRepository');

export interface IPricesRepository {
  getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number | null>;

  getTokenPrices(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]>;

  /**
   * Gets the list of supported fiat codes.
   * @returns an alphabetically ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<string[]>;
}
