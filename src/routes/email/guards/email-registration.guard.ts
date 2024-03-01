import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { verifyMessage } from 'viem';

/**
 * The EmailRegistrationGuard guard should be used on routes that require
 * authenticated actions on registering email addresses.
 *
 * This guard therefore validates if the message came from the specified account.
 *
 * The following message should be signed:
 * email-register-${chainId}-${safe}-${emailAddress}-${account}-${timestamp}
 *
 * (where ${} represents placeholder values for the respective data)
 *
 * To use this guard, the route should have:
 * - the 'chainId' declared as a parameter
 * - the 'safeAddress' declared as a parameter
 * - the 'emailAddress' as part of the JSON body (top level)
 * - the 'account' as part of the JSON body (top level)
 * - the 'signature' as part of the JSON body (top level) - see message format to be signed
 * - the 'timestamp' as part of the JSON body (top level)
 */
@Injectable()
export class EmailRegistrationGuard implements CanActivate {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  private static readonly ACTION_PREFIX = 'email-register';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const chainId = request.params['chainId'];
    const safe = request.params['safeAddress'];
    const emailAddress = request.body['emailAddress'];
    const account = request.body['account'];
    const signature = request.body['signature'];
    const timestamp = request.body['timestamp'];

    // Required fields
    if (
      !chainId ||
      !safe ||
      !signature ||
      !emailAddress ||
      !account ||
      !timestamp
    )
      return false;

    const message = `${EmailRegistrationGuard.ACTION_PREFIX}-${chainId}-${safe}-${emailAddress}-${account}-${timestamp}`;

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
