import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import {
  ChainLenientPageSchema,
  ChainSchema,
} from '@/domain/chains/entities/schemas/chain.schema';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
import { SingletonsSchema } from '@/domain/chains/entities/schemas/singleton.schema';
import { Page } from '@/domain/entities/page.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  IndexingStatus,
  IndexingStatusSchema,
} from '@/domain/indexing/entities/indexing-status.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import differenceBy from 'lodash/differenceBy';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LenientBasePageSchema } from '@/domain/entities/schemas/page.schema.factory';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  // According to the limits of the Config Service
  // @see https://github.com/safe-global/safe-config-service/blob/main/src/chains/views.py#L14-L16
  static readonly MAX_LIMIT = 40;

  private readonly maxSequentialPages: number;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxSequentialPages = this.configurationService.getOrThrow<number>(
      'safeConfig.chains.maxSequentialPages',
    );
  }

  async getChain(chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChain(chainId);
    return ChainSchema.parse(chain);
  }

  async clearChain(chainId: string): Promise<void> {
    return this.configApi.clearChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi
      .getChains({ limit, offset })
      .then(LenientBasePageSchema.parse);
    const valid = ChainLenientPageSchema.parse(page);
    if (valid.results.length < page.results.length) {
      this.loggingService.error({
        message: 'Some chains could not be parsed',
        errors: differenceBy(page.results, valid.results, 'chainId'),
      });
    }
    return valid;
  }

  async getAllChains(): Promise<Array<Chain>> {
    const chains: Array<Chain> = [];

    let offset = 0;
    let next = null;

    for (let i = 0; i < this.maxSequentialPages; i++) {
      const result = await this.getChains(ChainsRepository.MAX_LIMIT, offset);

      next = result.next;
      chains.push(...result.results);

      if (!next) {
        break;
      }

      const url = new URL(next);
      const paginationData = PaginationData.fromLimitAndOffset(url);
      offset = paginationData.offset;
    }

    if (next) {
      this.loggingService.error(
        'More chains available despite request limit reached',
      );
    }

    return chains;
  }

  async getSingletons(chainId: string): Promise<Array<Singleton>> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);
    const singletons = await transactionApi.getSingletons();
    return SingletonsSchema.parse(singletons);
  }

  async getIndexingStatus(chainId: string): Promise<IndexingStatus> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);
    const indexingStatus = await transactionApi.getIndexingStatus();
    return IndexingStatusSchema.parse(indexingStatus);
  }

  async isSupportedChain(chainId: string): Promise<boolean> {
    return this.getChain(chainId)
      .then(() => true)
      .catch(() => false);
  }
}
