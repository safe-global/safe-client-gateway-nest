import { Chain } from '@/domain/chains/entities/chain.entity';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
import { Page } from '@/domain/entities/page.entity';
import { Module } from '@nestjs/common';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { IndexingStatus } from '@/domain/indexing/entities/indexing-status.entity';

export const IChainsRepository = Symbol('IChainsRepository');

export interface IChainsRepository {
  /**
   * Gets a collection of {@link Chain} in a paginated format
   *
   * @param limit - the amount of chains to retrieve per {@link Page}
   * @param offset - the starting point for the pagination
   */
  getChains(limit?: number, offset?: number): Promise<Page<Chain>>;

  /**
   * Gets all the {@link Chain} available across pages
   */
  getAllChains(): Promise<Array<Chain>>;

  /**
   * Gets the {@link Chain} associated with {@link chainId}
   *
   * @param chainId
   */
  getChain(chainId: string): Promise<Chain>;

  /**
   * Triggers the removal of the chain data stored in the DataSource (e.g. cache)
   */
  clearChain(chainId: string): Promise<void>;

  /**
   * Gets the supported {@link Singleton} associated with {@link chainId}
   *
   * @param chainId
   */
  getSingletons(chainId: string): Promise<Array<Singleton>>;

  /**
   * Gets the {@link IndexingStatus} associated with {@link chainId}
   *
   * @param chainId
   */
  getIndexingStatus(chainId: string): Promise<IndexingStatus>;

  /**
   * Checks if the {@link Chain} associated with {@link chainId} is supported.
   *
   * @param chainId
   */
  isSupportedChain(chainId: string): Promise<boolean>;
}

@Module({
  imports: [ConfigApiModule, TransactionApiManagerModule],
  providers: [
    {
      provide: IChainsRepository,
      useClass: ChainsRepository,
    },
  ],
  exports: [IChainsRepository],
})
export class ChainsRepositoryModule {}
