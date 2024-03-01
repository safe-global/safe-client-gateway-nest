import { CanActivate, ExecutionContext, Type, mixin } from '@nestjs/common';

/**
 * Returns a guard mixin that can be used to check if a 'timestamp'
 * provided in the body of the HTTP request is within maxElapsedTimeMs
 * from the current system time in UTC.
 *
 * @param maxElapsedTimeMs - the amount in ms to which this guard should allow
 * the request to go through
 */
export const TimestampGuard = (maxElapsedTimeMs: number): Type<CanActivate> => {
  class TimestampGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();

      const timestampRaw = request.body['timestamp'];
      const timestamp = parseInt(timestampRaw);
      if (isNaN(timestamp)) return false;

      // UTC timezone
      const now = Date.now();
      return now - timestamp < maxElapsedTimeMs;
    }
  }

  return mixin(TimestampGuardMixin);
};
