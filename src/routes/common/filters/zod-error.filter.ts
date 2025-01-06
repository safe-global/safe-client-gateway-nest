import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ZodError, ZodIssue } from 'zod';
import { Response } from 'express';
import { ZodErrorWithCode } from '@/validation/pipes/validation.pipe';

/**
 * This {@link ExceptionFilter} catches any {@link ZodError} thrown from
 * the domain or {@link ZodErrorWithCode} thrown at the route level.
 *
 * It builds a JSON payload which contains a code and a message.
 * The message is read from the initial {@link ZodIssue} and the code
 * from {@link ZodErrorWithCode.code} or 502 if {@link ZodError}.
 */
@Catch(ZodError, ZodErrorWithCode)
export class ZodErrorFilter implements ExceptionFilter {
  catch(exception: ZodError | ZodErrorWithCode, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ZodErrorWithCode) {
      const code = exception.code;
      const error = this.mapZodErrorResponse(exception);

      response.status(code).json({
        statusCode: code,
        ...error,
      });
    } else {
      // Don't expose validation as it may contain sensitive data
      response.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Bad gateway',
      });
    }
  }

  private mapZodErrorResponse(exception: ZodError): ZodIssue {
    return exception.issues[0].code === 'invalid_union'
      ? this.mapZodErrorResponse(exception.issues[0].unionErrors[0])
      : exception.issues[0];
  }
}
