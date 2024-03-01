import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InvalidVerificationCodeError } from '@/domain/account/errors/invalid-verification-code.error';

@Catch(InvalidVerificationCodeError)
export class InvalidVerificationCodeExceptionFilter implements ExceptionFilter {
  catch(exception: InvalidVerificationCodeError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.BAD_REQUEST).json({
      message: `The provided verification code is not valid.`,
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}
