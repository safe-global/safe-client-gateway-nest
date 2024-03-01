import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { verifyMessage } from 'viem';

/**
 * The EmailDeletionGuard guard should be used on routes that require
 * authenticated actions for deleting email addresses.
 *
 * This guard therefore validates if the message came from the specified account.
 *
 * The following message should be signed:
 * email-delete-${chainId}-${safe}-${emailAddress}-${account}-${timestamp}
 *
 * (where ${} represents placeholder values for the respective data)
 *
 * To use this guard, the route should have:
 * - the 'chainId' declared as a parameter
 * - the 'safeAddress' declared as a parameter
 * - the 'account' as part of the JSON body (top level)
 * - the 'signature' as part of the JSON body (top level) - see message format to be signed
 * - the 'timestamp' as part of the JSON body (top level)
 */
@Injectable()
export class EmailDeletionGuard implements CanActivate {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  private static readonly ACTION_PREFIX = 'email-delete';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const chainId = request.params['chainId'];
    const safe = request.params['safeAddress'];
    const account = request.body['account'];
    const signature = request.body['signature'];
    const timestamp = request.body['timestamp'];

    // Required fields
    if (!chainId || !safe || !signature || !account || !timestamp) return false;

    const message = `${EmailDeletionGuard.ACTION_PREFIX}-${chainId}-${safe}-${account}-${timestamp}`;

    try {
      return await verifyMessage({
        address: account,
        message,
        signature,
      });
    } catch (e) {
      this.loggingService.debug(e);
      return false;
    }
  }
}
