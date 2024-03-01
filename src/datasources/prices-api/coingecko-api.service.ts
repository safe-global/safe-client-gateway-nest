import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IPricesApi } from '@/domain/interfaces/prices-api.interface';
import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheRouter } from '../cache/cache.router';
import { DataSourceError } from '@/domain/errors/data-source.error';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { difference } from 'lodash';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class CoingeckoApi implements IPricesApi {
  /**
   *  Coingecko API Key header name. To be included in http requests when using a paid subscription.
   */
  private static readonly pricesProviderHeader: string = 'x-cg-pro-api-key';

  /**
   * Coingecko API maximum amount of token addresses being requested in the same call.
   */
  private static readonly maxBatchSize: number = 100;

  /**
   * Time range in seconds used to get a random value when calculating a TTL for not-found token prices.
   */
  static readonly notFoundTtlRangeSeconds: number = 60 * 60 * 24;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly pricesTtlSeconds: number;
  private readonly notFoundPriceTtlSeconds: number;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly dataSource: CacheFirstDataSource,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.apiKey = this.configurationService.get<string>('prices.apiKey');
    this.baseUrl =
      this.configurationService.getOrThrow<string>('prices.baseUri');
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.pricesTtlSeconds = this.configurationService.getOrThrow<number>(
      'prices.pricesTtlSeconds',
    );
    this.notFoundPriceTtlSeconds = this.configurationService.getOrThrow<number>(
      'prices.notFoundPriceTtlSeconds',
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
      const cacheDir = CacheRouter.getNativeCoinPriceCacheDir(args);
      const url = `${this.baseUrl}/simple/price`;
      return await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: {
          params: {
            vs_currencies: args.fiatCode,
            ids: args.nativeCoinId,
          },
          ...(this.apiKey && {
            headers: {
              [CoingeckoApi.pricesProviderHeader]: this.apiKey,
            },
          }),
        },
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.pricesTtlSeconds,
      });
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${
          args.nativeCoinId
        } price from provider${this._mapProviderError(error)}`,
      );
    }
  }

  /**
   * Gets prices for a set of token addresses, trying to get them from cache first.
   * For those not found in the cache, it tries to retrieve them from the Coingecko API.
   *
   * @param args.chainName Coingecko's name for the chain (see configuration)
   * @param args.tokenAddresses Array of token addresses which prices are being retrieved
   * @param args.fiatCode
   * @returns Array of {@link AssetPrice}
   */
  async getTokenPrices(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]> {
    const pricesFromCache = await this._getTokenPricesFromCache(args);
    const notCachedTokenPrices = difference(
      args.tokenAddresses,
      pricesFromCache.map((assetPrice) => Object.keys(assetPrice)).flat(),
    );
    const pricesFromNetwork = notCachedTokenPrices.length
      ? await this._getTokenPricesFromNetwork({
          ...args,
          tokenAddresses: notCachedTokenPrices,
        })
      : [];

    return [pricesFromCache, pricesFromNetwork].flat();
  }

  async getFiatCodes(): Promise<string[]> {
    try {
      const cacheDir = CacheRouter.getPriceFiatCodesCacheDir();
      const url = `${this.baseUrl}/simple/supported_vs_currencies`;
      return await this.dataSource.get({
        cacheDir,
        url,
        networkRequest: {
          ...(this.apiKey && {
            headers: {
              [CoingeckoApi.pricesProviderHeader]: this.apiKey,
            },
          }),
        },
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw new DataSourceError(
        `Error getting Fiat Codes from prices provider${this._mapProviderError(
          error,
        )}`,
      );
    }
  }

  private _mapProviderError(error: any): string {
    const errorCode = error?.status?.error_code;
    return errorCode ? ` [status: ${errorCode}]` : '';
  }

  /**
   * For an array of token addresses, gets the prices available from cache.
   */
  private async _getTokenPricesFromCache(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]> {
    const result: AssetPrice[] = [];
    for (const tokenAddress of args.tokenAddresses) {
      const cacheDir = CacheRouter.getTokenPriceCacheDir({
        ...args,
        tokenAddress,
      });
      const cached = await this.cacheService.get(cacheDir);
      const { key, field } = cacheDir;
      if (cached != null) {
        this.loggingService.debug({ type: 'cache_hit', key, field });
        result.push(JSON.parse(cached));
      } else {
        this.loggingService.debug({ type: 'cache_miss', key, field });
      }
    }
    return result;
  }

  /**
   * For an array of token addresses, gets the prices available from the CoinGecko API.
   * Stores both retrieved prices and not-found prices in cache.
   */
  private async _getTokenPricesFromNetwork(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]> {
    const prices = await this._requestPricesFromNetwork({
      ...args,
      tokenAddresses: args.tokenAddresses.slice(0, CoingeckoApi.maxBatchSize),
    });

    return Promise.all(
      args.tokenAddresses.map(async (tokenAddress) => {
        const validPrice = prices[tokenAddress]?.[args.fiatCode];
        const price: AssetPrice = validPrice
          ? { [tokenAddress]: { [args.fiatCode]: validPrice } }
          : { [tokenAddress]: { [args.fiatCode]: null } };
        await this.cacheService.set(
          CacheRouter.getTokenPriceCacheDir({ ...args, tokenAddress }),
          JSON.stringify(price),
          validPrice
            ? this.pricesTtlSeconds
            : this._getRandomNotFoundTokenPriceTtl(),
        );
        return price;
      }),
    );
  }

  /**
   * Requests the token prices provided by the CoinGecko API, using the {@link NetworkService}.
   */
  private async _requestPricesFromNetwork(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice> {
    try {
      const url = `${this.baseUrl}/simple/token_price/${args.chainName}`;
      const { data } = await this.networkService.get(url, {
        params: {
          vs_currencies: args.fiatCode,
          contract_addresses: args.tokenAddresses.join(','),
        },
        ...(this.apiKey && {
          headers: {
            [CoingeckoApi.pricesProviderHeader]: this.apiKey,
          },
        }),
      });
      return data;
    } catch (error) {
      throw new DataSourceError(
        `Error getting ${
          args.tokenAddresses
        } price from provider${this._mapProviderError(error)}`,
      );
    }
  }

  /**
   * Gets a random integer value between (notFoundPriceTtlSeconds - notFoundTtlRangeSeconds)
   * and (notFoundPriceTtlSeconds + notFoundTtlRangeSeconds).
   */
  private _getRandomNotFoundTokenPriceTtl(): number {
    const min =
      this.notFoundPriceTtlSeconds - CoingeckoApi.notFoundTtlRangeSeconds;
    const max =
      this.notFoundPriceTtlSeconds + CoingeckoApi.notFoundTtlRangeSeconds;
    return Math.floor(Math.random() * (max - min) + min);
  }
}
