import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { EmailService } from '@/routes/email/email.service';
import { EmailRegistrationGuard } from '@/routes/email/guards/email-registration.guard';
import { EmailDeletionGuard } from '@/routes/email/guards/email-deletion.guard';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { OnlySafeOwnerGuard } from '@/routes/email/guards/only-safe-owner.guard';
import { SaveEmailDto } from '@/routes/email/entities/save-email-dto.entity';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { ResendVerificationDto } from '@/routes/email/entities/resend-verification-dto.entity';
import { EmailAlreadyVerifiedExceptionFilter } from '@/routes/email/exception-filters/email-already-verified.exception-filter';
import { ResendVerificationTimespanExceptionFilter } from '@/routes/email/exception-filters/resend-verification-timespan-error.exception-filter';
import { VerifyEmailDto } from '@/routes/email/entities/verify-email-dto.entity';
import { InvalidVerificationCodeExceptionFilter } from '@/routes/email/exception-filters/invalid-verification-code.exception-filter';
import { DeleteEmailDto } from '@/routes/email/entities/delete-email-dto.entity';
import { AccountDoesNotExistExceptionFilter } from '@/routes/email/exception-filters/acocunt-does-not-exist.exception-filter';
import { EditEmailDto } from '@/routes/email/entities/edit-email-dto.entity';
import { EmailEditGuard } from '@/routes/email/guards/email-edit.guard';
import { EmailEditMatchesExceptionFilter } from '@/routes/email/exception-filters/email-edit-matches.exception-filter';
import { EmailEditTimespanExceptionFilter } from '@/routes/email/exception-filters/email-edit-timespan.exception-filter';

@ApiTags('email')
@Controller({
  path: 'chains/:chainId/safes/:safeAddress/emails',
  version: '1',
})
@ApiExcludeController()
export class EmailController {
  constructor(private readonly service: EmailService) {}

  @Post('')
  @UseGuards(
    EmailRegistrationGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  async saveEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() saveEmailDto: SaveEmailDto,
  ): Promise<void> {
    await this.service.saveEmail({
      chainId,
      emailAddress: saveEmailDto.emailAddress,
      safeAddress,
      signer: saveEmailDto.signer,
    });
  }

  @Put('verify-resend')
  @UseFilters(
    EmailAlreadyVerifiedExceptionFilter,
    ResendVerificationTimespanExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<void> {
    await this.service.resendVerification({
      chainId,
      safeAddress,
      signer: resendVerificationDto.signer,
    });
  }

  @Put('verify')
  @UseFilters(InvalidVerificationCodeExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmailAddress(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<void> {
    await this.service.verifyEmailAddress({
      chainId,
      safeAddress,
      signer: verifyEmailDto.signer,
      code: verifyEmailDto.code,
    });
  }

  @Delete('')
  @UseGuards(
    EmailDeletionGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
  )
  @UseFilters(AccountDoesNotExistExceptionFilter)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() deleteEmailDto: DeleteEmailDto,
  ): Promise<void> {
    await this.service.deleteEmail({
      chainId,
      safeAddress,
      signer: deleteEmailDto.signer,
    });
  }

  @Put('')
  @UseGuards(
    EmailEditGuard,
    TimestampGuard(5 * 60 * 1000), // 5 minutes
    OnlySafeOwnerGuard,
  )
  @UseFilters(
    EmailEditTimespanExceptionFilter,
    EmailEditMatchesExceptionFilter,
    AccountDoesNotExistExceptionFilter,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async editEmail(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body() editEmailDto: EditEmailDto,
  ): Promise<void> {
    await this.service.editEmail({
      chainId,
      safeAddress,
      signer: editEmailDto.signer,
      emailAddress: editEmailDto.emailAddress,
    });
  }
}
