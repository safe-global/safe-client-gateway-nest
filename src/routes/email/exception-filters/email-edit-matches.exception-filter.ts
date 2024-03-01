import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { EmailEditMatchesError } from '@/domain/account/errors/email-edit-matches.error';

@Catch(EmailEditMatchesError)
export class EmailEditMatchesExceptionFilter implements ExceptionFilter {
  catch(exception: EmailEditMatchesError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.CONFLICT).json({
      message: 'Email address matches that of the Safe owner.',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
