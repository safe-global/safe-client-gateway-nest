import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ResendVerificationTimespanError } from '@/domain/account/errors/verification-timeframe.error';

@Catch(ResendVerificationTimespanError)
export class ResendVerificationTimespanExceptionFilter
  implements ExceptionFilter
{
  catch(exception: ResendVerificationTimespanError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      message: `Verification cannot be resent at this time`,
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  }
}
