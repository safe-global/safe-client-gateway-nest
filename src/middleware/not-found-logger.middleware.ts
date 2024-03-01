import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { formatRouteLogMessage } from '@/logging/utils';

/**
 * Middleware which logs requests that resulted in 404. Request side effects
 * that are not tied to any route can be handled here.
 *
 * Since a 404 can be triggered by non-existing routes,
 * the {@link RouteLoggerInterceptor} might never be triggered because there
 * are no routes to handle this request.
 */
@Injectable()
export class NotFoundLoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTimeMs: number = performance.now();

    res.on('finish', () => {
      const { statusCode } = res;
      if (statusCode === 404) {
        this.loggingService.info(
          formatRouteLogMessage(statusCode, req, startTimeMs),
        );
      }
    });

    next();
  }
}
