import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { Page } from '@/domain/entities/page.entity';

export const IDelegateRepository = Symbol('IDelegateRepository');

export interface IDelegateRepository {
  getDelegates(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    signature?: string;
    label?: string;
  }): Promise<void>;

  deleteDelegate(args: {
    chainId: string;
    delegate: string;
    delegator: string;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    chainId: string;
    delegate: string;
    safeAddress: string;
    signature: string;
  }): Promise<unknown>;
}
