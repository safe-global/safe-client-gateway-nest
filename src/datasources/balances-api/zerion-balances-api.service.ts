import { IConfigurationService } from '@/config/configuration.service.interface';
import { ChainAttributes } from '@/datasources/balances-api/entities/provider-chain-attributes.entity';
import {
  ZerionAttributes,
  ZerionBalance,
  ZerionBalanceSchema,
  ZerionBalances,
  ZerionBalancesSchema,
} from '@/datasources/balances-api/entities/zerion-balance.entity';
import {
  ZerionCollectible,
  ZerionCollectibles,
  ZerionCollectiblesSchema,
} from '@/datasources/balances-api/entities/zerion-collectible.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import {
  Balance,
  Erc20Balance,
  NativeBalance,
} from '@/domain/balances/entities/balance.entity';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { Page } from '@/domain/entities/page.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { z, ZodError } from 'zod';

export const IZerionBalancesApi = Symbol('IZerionBalancesApi');

@Injectable()
export class ZerionBalancesApi implements IBalancesApi {
  private static readonly COLLECTIBLES_SORTING = '-floor_price';
  private static readonly RATE_LIMIT_CACHE_KEY_PREFIX = 'zerion';
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly chainsConfiguration: Record<number, ChainAttributes>;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;
  private readonly fiatCodes: Array<string>;
  // Number of seconds for each rate-limit cycle
  private readonly limitPeriodSeconds: number;
  // Number of allowed calls on each rate-limit cycle
  private readonly limitCalls: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
    this.chainsConfiguration = this.configurationService.getOrThrow<
      Record<number, ChainAttributes>
    >('balances.providers.zerion.chains');
    this.fiatCodes = this.configurationService
      .getOrThrow<Array<string>>('balances.providers.zerion.currencies')
      .map((currency) => currency.toUpperCase());
    this.limitPeriodSeconds = configurationService.getOrThrow(
      'balances.providers.zerion.limitPeriodSeconds',
    );
    this.limitCalls = configurationService.getOrThrow(
      'balances.providers.zerion.limitCalls',
    );
  }

  async getBalances(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    fiatCode: string;
  }): Promise<Raw<Array<Balance>>> {
    if (!this.fiatCodes.includes(args.fiatCode.toUpperCase())) {
      throw new DataSourceError(
        `Unsupported currency code: ${args.fiatCode}`,
        400,
      );
    }

    const cacheDir = CacheRouter.getZerionBalancesCacheDir({
      chainId: args.chain.chainId,
      safeAddress: args.safeAddress,
      fiatCode: args.fiatCode,
    });
    const chainName = this._getChainName(args.chain);
    const cached = await this.cacheService.hGet(cacheDir);
    if (cached != null) {
      const { key, field } = cacheDir;
      this.loggingService.debug({ type: 'cache_hit', key, field });
      const zerionBalances = z
        .array(ZerionBalanceSchema)
        .parse(JSON.parse(cached));
      return this._mapBalances(chainName, zerionBalances);
    }

    try {
      await this._checkRateLimit();
      const { key, field } = cacheDir;
      this.loggingService.debug({ type: 'cache_miss', key, field });
      const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/positions`;
      const networkRequest = {
        headers: { Authorization: `Basic ${this.apiKey}` },
        params: {
          'filter[chain_ids]': chainName,
          currency: args.fiatCode.toLowerCase(),
          sort: 'value',
        },
      };
      const zerionBalances = await this.networkService
        .get<ZerionBalances>({
          url,
          networkRequest,
        })
        .then(({ data }) => ZerionBalancesSchema.parse(data));
      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(zerionBalances.data),
        this.defaultExpirationTimeInSeconds,
      );
      return this._mapBalances(chainName, zerionBalances.data);
    } catch (error) {
      if (error instanceof LimitReachedError || error instanceof ZodError) {
        throw error;
      }
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * NOTE: Zerion does not support limit & offset parameters.
   * Documentation: https://developers.zerion.io/reference/listwalletnftpositions
   *
   * It uses a "size" query param for the page size, and an "after" parameter for the offset.
   * "size" is an integer which could be mapped to "limit", but "after" is a base64-encoded string.
   *
   * Since this setup does not align well with the CGW API, it is needed to encode/decode these parameters.
   */
  async getCollectibles(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Collectible>>> {
    const cacheDir = CacheRouter.getZerionCollectiblesCacheDir({
      ...args,
      chainId: args.chain.chainId,
    });
    const cached = await this.cacheService.hGet(cacheDir);
    if (cached != null) {
      const { key, field } = cacheDir;
      this.loggingService.debug({ type: 'cache_hit', key, field });
      const data = ZerionCollectiblesSchema.parse(JSON.parse(cached));
      return this._buildCollectiblesPage(data.links.next, data.data);
    } else {
      try {
        await this._checkRateLimit();
        const chainName = this._getChainName(args.chain);
        const url = `${this.baseUri}/v1/wallets/${args.safeAddress}/nft-positions`;
        const pageAfter = this._encodeZerionPageOffset(args.offset);
        const networkRequest = {
          headers: { Authorization: `Basic ${this.apiKey}` },
          params: {
            'filter[chain_ids]': chainName,
            sort: ZerionBalancesApi.COLLECTIBLES_SORTING,
            'page[size]': args.limit,
            ...(pageAfter && { 'page[after]': pageAfter }),
          },
        };
        const zerionCollectibles = await this.networkService
          .get<ZerionCollectibles>({
            url,
            networkRequest,
          })
          .then(({ data }) => ZerionCollectiblesSchema.parse(data));
        await this.cacheService.hSet(
          cacheDir,
          JSON.stringify(zerionCollectibles),
          this.defaultExpirationTimeInSeconds,
        );
        return this._buildCollectiblesPage(
          zerionCollectibles.links.next,
          zerionCollectibles.data,
        );
      } catch (error) {
        if (error instanceof ZodError) {
          throw error;
        }
        throw this.httpErrorFactory.from(error);
      }
    }
  }

  async clearCollectibles(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const key = CacheRouter.getZerionCollectiblesCacheKey(args);
    await this.cacheService.deleteByKey(key);
  }

  private _mapBalances(
    chainName: string,
    zerionBalances: Array<ZerionBalance>,
  ): Raw<Array<Balance>> {
    const balances = zerionBalances
      .filter((zb) => zb.attributes.flags.displayable)
      .map((zb) => {
        const implementation = zb.attributes.fungible_info.implementations.find(
          (implementation) => implementation.chain_id === chainName,
        );
        if (!implementation)
          throw Error(
            `Zerion error: ${chainName} implementation not found for balance ${zb.id}`,
          );
        const { value, price } = zb.attributes;
        const fiatBalance = value ? getNumberString(value) : null;
        const fiatConversion = price ? getNumberString(price) : null;

        return {
          ...(implementation.address === null
            ? this._mapNativeBalance(zb.attributes)
            : this._mapErc20Balance(zb.attributes, implementation.address)),
          fiatBalance,
          fiatConversion,
        };
      });
    return rawify(balances);
  }

  async getFiatCodes(): Promise<Raw<Array<string>>> {
    // Resolving to conform with interface
    return Promise.resolve(rawify(this.fiatCodes));
  }

  private _mapErc20Balance(
    zerionBalanceAttributes: ZerionAttributes,
    tokenAddress: string,
  ): Erc20Balance {
    const { fungible_info, quantity } = zerionBalanceAttributes;
    return {
      tokenAddress: getAddress(tokenAddress),
      token: {
        name: fungible_info.name ?? '',
        symbol: fungible_info.symbol ?? '',
        decimals: quantity.decimals,
        logoUri: fungible_info.icon?.url ?? '',
      },
      balance: quantity.int,
    };
  }

  private _mapNativeBalance(
    zerionBalanceAttributes: ZerionAttributes,
  ): NativeBalance {
    return {
      tokenAddress: null,
      token: null,
      balance: zerionBalanceAttributes.quantity.int,
    };
  }

  async clearBalances(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const key = CacheRouter.getZerionBalancesCacheKey(args);
    await this.cacheService.deleteByKey(key);
  }

  private _getChainName(chain: Chain): string {
    const chainName =
      chain.balancesProvider.chainName ??
      this.chainsConfiguration[Number(chain.chainId)]?.chainName;

    if (!chainName)
      throw Error(
        `Chain ${chain.chainId} balances retrieval via Zerion is not configured`,
      );

    return chainName;
  }

  private _buildCollectiblesPage(
    next: string | null,
    data: Array<ZerionCollectible>,
  ): Raw<Page<Collectible>> {
    // Zerion does not provide the items count.
    // Zerion does not provide a "previous" cursor.
    return rawify({
      count: null,
      next: next ? this._decodeZerionPagination(next) : null,
      previous: null,
      results: this._mapCollectibles(data),
    });
  }

  private _mapCollectibles(
    zerionCollectibles: Array<ZerionCollectible>,
  ): Array<Collectible> {
    return zerionCollectibles.map(
      ({ attributes: { nft_info, collection_info } }) => ({
        address: nft_info.contract_address,
        tokenName: nft_info.name ?? '',
        tokenSymbol: nft_info.name ?? '',
        logoUri: collection_info?.content?.icon.url ?? '',
        id: nft_info.token_id,
        uri: nft_info.content?.detail?.url ?? null,
        name: collection_info?.name ?? null,
        description: collection_info?.description ?? null,
        imageUri: nft_info.content?.preview?.url ?? '',
        metadata: nft_info.content,
      }),
    );
  }

  /**
   * Zerion represents cursor offsets by base64 string
   * contained within double quotation marks.
   *
   * @param offset number representing the offset
   * @returns base64 string representing the offset
   */
  private _encodeZerionPageOffset(offset?: number): string | null {
    return offset
      ? Buffer.from(`"${offset}"`, 'utf8').toString('base64')
      : null;
  }

  /**
   * Zerion uses page[size] as pagination limit.
   * Zerion uses page[after] as pagination offset, which is a
   * base64 string contained within double quotation marks.
   *
   * @param url Zerion-formatted string representing an URL
   * @returns URL string optionally containing "limit" and "offset" query params
   */
  private _decodeZerionPagination(url: string): string {
    const zerionUrl = new URL(url);
    const size = zerionUrl.searchParams.get('page[size]');
    const after = zerionUrl.searchParams.get('page[after]');

    if (size) zerionUrl.searchParams.set('limit', size);
    if (after) {
      zerionUrl.searchParams.set(
        'offset',
        Buffer.from(after ?? '0', 'base64')
          .toString('utf8')
          .replace(/"/g, ''),
      );
    }
    return zerionUrl.toString();
  }

  private async _checkRateLimit(): Promise<void> {
    const current = await this.cacheService.increment(
      CacheRouter.getRateLimitCacheKey(
        ZerionBalancesApi.RATE_LIMIT_CACHE_KEY_PREFIX,
      ),
      this.limitPeriodSeconds,
    );
    if (current > this.limitCalls) throw new LimitReachedError();
  }
}
