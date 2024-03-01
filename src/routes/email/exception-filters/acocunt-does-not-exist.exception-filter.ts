import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AccountDoesNotExistError } from '@/datasources/account/errors/account-does-not-exist.error';

@Catch(AccountDoesNotExistError)
export class AccountDoesNotExistExceptionFilter implements ExceptionFilter {
  catch(exception: AccountDoesNotExistError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.NOT_FOUND).json({
      message: `No email address was found for the provided signer ${exception.signer}.`,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}
