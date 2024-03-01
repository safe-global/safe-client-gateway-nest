import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

/**
 * The OnlySafeOwner guard can be applied to any route that requires
 * that a provided 'account' (owner) is part of a Safe
 *
 * This guard does not validate that a message came from said owner.
 *
 * To use this guard, the route should have:
 * - the 'chainId' declared as a parameter
 * - the 'safeAddress' declared as a parameter
 * - the 'account' as part of the JSON body (top level)
 */
@Injectable()
export class OnlySafeOwnerGuard implements CanActivate {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const chainId = request.params['chainId'];
    const safe = request.params['safeAddress'];
    const account = request.body['account'];

    // Required fields
    if (!chainId || !safe || !account) return false;

    return await this.safeRepository.isOwner({
      chainId,
      safeAddress: safe,
      address: account,
    });
  }
}
