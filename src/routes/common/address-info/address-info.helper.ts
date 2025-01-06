import { Inject, Injectable } from '@nestjs/common';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

export type Source = 'CONTRACT' | 'TOKEN';

@Injectable()
export class AddressInfoHelper {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Returns a promise for {@link AddressInfo} which contains the source
   * information for {@link address}
   *
   * The promise can be rejected if the address info cannot be retrieved for
   * any specified {@link source}
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */

  async get(
    chainId: string,
    address: `0x${string}`,
    sources: Array<Source>,
  ): Promise<AddressInfo> {
    for (const source of sources) {
      try {
        return await this._getFromSource(chainId, address, source);
      } catch {
        this.loggingService.debug(
          `Could not get address info with source=${source} for ${address}`,
        );
      }
    }
    return Promise.reject(
      `Could not get address info from provided sources=${sources} for ${address}`,
    );
  }

  /**
   * Similar to {@see get} but should never fail.
   *
   * If a source address cannot be retrieved, a {@link AddressInfo} is returned
   * containing just the source address
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */
  getOrDefault(
    chainId: string,
    address: `0x${string}`,
    sources: Array<Source>,
  ): Promise<AddressInfo> {
    return this.get(chainId, address, sources).catch(
      () => new AddressInfo(address),
    );
  }

  /**
   * Similar to {@see getOrDefault} but works with a collection of source addresses
   *
   * @param chainId - the chain id where the source exists
   * @param addresses - the collection of addresses to which we want to retrieve the respective metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */
  getCollection(
    chainId: string,
    addresses: Array<`0x${string}`>,
    sources: Array<Source>,
  ): Promise<Array<AddressInfo>> {
    return Promise.allSettled(
      addresses.map((address) => this.getOrDefault(chainId, address, sources)),
    ).then((results) =>
      results.map((result) => {
        if (result.status == 'fulfilled') return result.value;
        else throw new Error('Error processing address collection');
      }),
    );
  }

  private _getFromSource(
    chainId: string,
    address: `0x${string}`,
    source: Source,
  ): Promise<AddressInfo> {
    switch (source) {
      case 'CONTRACT':
        return this.contractsRepository
          .getContract({ chainId, contractAddress: address })
          .then((c) => {
            const name = c.displayName || c.name;
            return new AddressInfo(c.address, name, c.logoUri);
          });
      case 'TOKEN':
        return this.tokenRepository
          .getToken({ chainId, address })
          .then((t) => new AddressInfo(t.address, t.name, t.logoUri));
      default:
        return Promise.reject('Unknown source');
    }
  }
}
