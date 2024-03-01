import { Inject, Injectable } from '@nestjs/common';
import { IDelegateRepository } from '@/domain/delegate/delegate.repository.interface';
import { Page } from '@/routes/common/entities/page.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import { Delegate } from '@/routes/delegates/entities/delegate.entity';
import { DeleteDelegateDto } from '@/routes/delegates/entities/delete-delegate.dto.entity';
import { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';
import { GetDelegateDto } from '@/routes/delegates/entities/get-delegate.dto.entity';

@Injectable()
export class DelegatesService {
  constructor(
    @Inject(IDelegateRepository)
    private readonly repository: IDelegateRepository,
  ) {}

  async getDelegates(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    getDelegateDto: GetDelegateDto;
    paginationData: PaginationData;
  }): Promise<Page<Delegate>> {
    const delegates = await this.repository.getDelegates({
      chainId: args.chainId,
      safeAddress: args.getDelegateDto.safe,
      delegate: args.getDelegateDto.delegate,
      delegator: args.getDelegateDto.delegator,
      label: args.getDelegateDto.label,
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

    const nextURL = cursorUrlFromLimitAndOffset(args.routeUrl, delegates.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      delegates.previous,
    );

    return {
      count: delegates.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: delegates.results,
    };
  }

  async postDelegate(args: {
    chainId: string;
    createDelegateDto: CreateDelegateDto;
  }): Promise<void> {
    await this.repository.postDelegate({
      chainId: args.chainId,
      safeAddress: args.createDelegateDto.safe,
      delegate: args.createDelegateDto.delegate,
      delegator: args.createDelegateDto.delegator,
      signature: args.createDelegateDto.signature,
      label: args.createDelegateDto.label,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegateAddress: string;
    deleteDelegateDto: DeleteDelegateDto;
  }): Promise<unknown> {
    return await this.repository.deleteDelegate({
      chainId: args.chainId,
      delegate: args.delegateAddress,
      delegator: args.deleteDelegateDto.delegator,
      signature: args.deleteDelegateDto.signature,
    });
  }

  async deleteSafeDelegate(args: {
    chainId: string;
    deleteSafeDelegateRequest: DeleteSafeDelegateDto;
  }): Promise<unknown> {
    return await this.repository.deleteSafeDelegate({
      chainId: args.chainId,
      delegate: args.deleteSafeDelegateRequest.delegate,
      safeAddress: args.deleteSafeDelegateRequest.safe,
      signature: args.deleteSafeDelegateRequest.signature,
    });
  }
}
