import { Inject, Injectable } from '@nestjs/common';
import { IPricesApi } from '../../domain/interfaces/prices-api.interface';
import { AssetPrice } from '../../domain/prices/entities/asset-price.entity';
import { CacheDir } from '../cache/entities/cache-dir.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { HttpErrorFactory } from '../errors/http-error-factory';

@Injectable()
export class PricesApi implements IPricesApi {
  private readonly baseUrl: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUrl =
      this.configurationService.getOrThrow<string>('prices.baseUri');
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  async getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<AssetPrice> {
    try {
      // TODO: move to CacheRouter
      const cacheDir = new CacheDir(
        `${args.nativeCoinId}_price`,
        `native_${args.fiatCode}`,
      );
      const url = `${this.baseUrl}/simple/price?ids=${args.nativeCoinId}&vs_currencies=${args.fiatCode}`;
      return await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
  async getTokenPrice(args: {
    nativeCoinId: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<AssetPrice> {
    try {
      // TODO: move to CacheRouter
      const cacheDir = new CacheDir(
        `${args.nativeCoinId}_price`,
        `${args.tokenAddress}_${args.fiatCode}`,
      );
      const url = `${this.baseUrl}/simple/token_price/${args.nativeCoinId}?contract_addresses=${args.tokenAddress}&vs_currencies=${args.fiatCode}`;
      const result: AssetPrice = await this.dataSource.get(
        cacheDir,
        url,
        this.defaultNotFoundExpirationTimeSeconds,
        undefined,
        this.defaultExpirationTimeInSeconds,
      );
      return result;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
