import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { EmailAlreadyVerifiedError } from '@/domain/account/errors/email-already-verified.error';
import { Response } from 'express';

@Catch(EmailAlreadyVerifiedError)
export class EmailAlreadyVerifiedExceptionFilter implements ExceptionFilter {
  catch(exception: EmailAlreadyVerifiedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.CONFLICT).json({
      message: `Cannot verify the provided email for the provided account ${exception.signer}`,
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
