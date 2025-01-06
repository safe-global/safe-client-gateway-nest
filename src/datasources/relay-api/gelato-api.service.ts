import { Inject, Injectable } from '@nestjs/common';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import type { Relay } from '@/domain/relay/entities/relay.entity';
import type { Raw } from '@/validation/entities/raw.entity';

@Injectable()
export class GelatoApi implements IRelayApi {
  /**
   * If you are using your own custom gas limit, please add a 150k gas buffer on top of the expected
   * gas usage for the transaction. This is for the Gelato Relay execution overhead, and adding this
   * buffer reduces your chance of the task cancelling before it is executed on-chain.
   * @see https://docs.gelato.network/developer-services/relay/quick-start/optional-parameters
   */
  private static GAS_LIMIT_BUFFER = BigInt(150_000);

  private readonly baseUri: string;
  private readonly ttlSeconds: number;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('relay.baseUri');
    this.ttlSeconds = configurationService.getOrThrow('relay.ttlSeconds');
  }

  async relay(args: {
    chainId: string;
    to: `0x${string}`;
    data: string;
    gasLimit: bigint | null;
  }): Promise<Raw<Relay>> {
    const sponsorApiKey = this.configurationService.getOrThrow<string>(
      `relay.apiKey.${args.chainId}`,
    );

    try {
      const url = `${this.baseUri}/relays/v2/sponsored-call`;
      const { data } = await this.networkService.post<Relay>({
        url,
        data: {
          sponsorApiKey,
          chainId: args.chainId,
          target: args.to,
          data: args.data,
          ...(args.gasLimit && {
            gasLimit: this.getRelayGasLimit(args.gasLimit).toString(),
          }),
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  private getRelayGasLimit(gasLimit: bigint): bigint {
    return gasLimit + GelatoApi.GAS_LIMIT_BUFFER;
  }

  async getRelayCount(args: {
    chainId: string;
    address: `0x${string}`;
    // TODO: Change to Raw when cache service is migrated
  }): Promise<number> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    const count = await this.cacheService.hGet(cacheDir);
    return count ? parseInt(count) : 0;
  }

  async setRelayCount(args: {
    chainId: string;
    address: `0x${string}`;
    count: number;
  }): Promise<void> {
    const cacheDir = CacheRouter.getRelayCacheDir(args);
    await this.cacheService.hSet(
      cacheDir,
      args.count.toString(),
      this.ttlSeconds,
    );
  }
}
