import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { Inject, Injectable } from '@nestjs/common';
import codeGenerator from '@/domain/account/code-generator';
import {
  Account,
  EmailAddress,
} from '@/domain/account/entities/account.entity';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { AccountSaveError } from '@/domain/account/errors/account-save.error';
import { ResendVerificationTimespanError } from '@/domain/account/errors/verification-timeframe.error';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EmailAlreadyVerifiedError } from '@/domain/account/errors/email-already-verified.error';
import { InvalidVerificationCodeError } from '@/domain/account/errors/invalid-verification-code.error';
import { EmailEditMatchesError } from '@/domain/account/errors/email-edit-matches.error';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import * as crypto from 'crypto';
import { EditTimespanError } from '@/domain/account/errors/email-timespan.error';

@Injectable()
export class AccountRepository implements IAccountRepository {
  private readonly verificationCodeResendLockWindowMs: number;
  private readonly verificationCodeTtlMs: number;
  private static readonly VERIFICATION_CODE_EMAIL_SUBJECT = 'Verification code';

  constructor(
    @Inject(IAccountDataSource)
    private readonly accountDataSource: IAccountDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IEmailApi) private readonly emailApi: IEmailApi,
  ) {
    this.verificationCodeResendLockWindowMs =
      this.configurationService.getOrThrow(
        'email.verificationCode.resendLockWindowMs',
      );
    this.verificationCodeTtlMs = this.configurationService.getOrThrow(
      'email.verificationCode.ttlMs',
    );
  }

  private _generateCode(): string {
    const verificationCode = codeGenerator();
    // Pads the final verification code to 6 characters
    // The generated code might have less than 6 digits so the version to be
    // validated against should account with the leading zeroes
    return verificationCode.toString().padStart(6, '0');
  }

  async createAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void> {
    const email = new EmailAddress(args.emailAddress);
    const verificationCode = this._generateCode();

    try {
      await this.accountDataSource.createAccount({
        chainId: args.chainId,
        code: verificationCode,
        emailAddress: email,
        safeAddress: args.safeAddress,
        signer: args.signer,
        codeGenerationDate: new Date(),
        unsubscriptionToken: crypto.randomUUID(),
      });
      await this._sendEmailVerification({
        ...args,
        code: verificationCode,
      });
    } catch (e) {
      throw new AccountSaveError(args.chainId, args.safeAddress, args.signer);
    }
  }

  async getVerifiedEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string[]> {
    const emails =
      await this.accountDataSource.getVerifiedAccountEmailsBySafeAddress(args);
    return emails.map(({ email }) => email);
  }

  async resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    let account = await this.accountDataSource.getAccount(args);

    // If the account was already verified, we should not send out a new
    // verification code
    if (account.isVerified) {
      throw new EmailAlreadyVerifiedError(args);
    }

    // If there's a date for when the verification was sent out,
    // check if timespan is still valid.
    if (account.verificationSentOn) {
      const timespanMs = Date.now() - account.verificationSentOn.getTime();
      if (timespanMs < this.verificationCodeResendLockWindowMs) {
        throw new ResendVerificationTimespanError({
          ...args,
          timespanMs,
          lockWindowMs: this.verificationCodeResendLockWindowMs,
        });
      }
    }

    if (!this._isEmailVerificationCodeValid(account)) {
      // Expired code. Generate new one
      await this.accountDataSource.setEmailVerificationCode({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        signer: args.signer,
        code: this._generateCode(),
        codeGenerationDate: new Date(),
      });
    }

    account = await this.accountDataSource.getAccount(args);
    if (!account.verificationCode) {
      throw new InvalidVerificationCodeError(args);
    }

    await this._sendEmailVerification({
      ...args,
      code: account.verificationCode,
      emailAddress: account.emailAddress.value,
    });
  }

  async verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
  }): Promise<void> {
    const account = await this.accountDataSource.getAccount(args);

    if (account.isVerified) {
      // account is already verified, so we don't need to perform further checks
      return;
    }

    if (account.verificationCode !== args.code) {
      throw new InvalidVerificationCodeError(args);
    }

    if (!this._isEmailVerificationCodeValid(account)) {
      throw new InvalidVerificationCodeError(args);
    }

    // TODO: it is possible that when verifying the email address, a new code generation was triggered
    return this.accountDataSource.verifyEmail(args);
  }

  async deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    const account = await this.accountDataSource.getAccount(args);
    await this.emailApi.deleteEmailAddress({
      emailAddress: account.emailAddress.value,
    });
    await this.accountDataSource.deleteAccount(args);
  }

  async editEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void> {
    const newEmail = new EmailAddress(args.emailAddress);
    const currentAccount = await this.accountDataSource.getAccount(args);

    // Prevent subsequent edit if verification code still valid
    if (
      currentAccount.verificationGeneratedOn &&
      this._isEmailVerificationCodeValid(currentAccount)
    ) {
      const timespanMs =
        Date.now() - currentAccount.verificationGeneratedOn.getTime();
      throw new EditTimespanError({
        ...args,
        timespanMs,
        lockWindowMs: this.verificationCodeResendLockWindowMs,
      });
    }

    if (newEmail.value === currentAccount.emailAddress.value) {
      throw new EmailEditMatchesError(args);
    }

    const verificationCode = this._generateCode();

    await this.accountDataSource.updateAccountEmail({
      chainId: args.chainId,
      code: verificationCode,
      emailAddress: newEmail,
      safeAddress: args.safeAddress,
      signer: args.signer,
      codeGenerationDate: new Date(),
      unsubscriptionToken: crypto.randomUUID(),
    });
    await this._sendEmailVerification({
      ...args,
      code: verificationCode,
    });
  }

  private _isEmailVerificationCodeValid(email: Account): boolean {
    if (!email.verificationGeneratedOn) return false;
    const window = Date.now() - email.verificationGeneratedOn.getTime();
    return window < this.verificationCodeTtlMs;
  }

  private async _sendEmailVerification(args: {
    signer: string;
    chainId: string;
    code: string;
    emailAddress: string;
    safeAddress: string;
  }): Promise<void> {
    await this.emailApi.createMessage({
      to: [args.emailAddress],
      template: this.configurationService.getOrThrow(
        'email.templates.verificationCode',
      ),
      subject: AccountRepository.VERIFICATION_CODE_EMAIL_SUBJECT,
      substitutions: { verificationCode: args.code },
    });

    // Update verification-sent date on a successful response
    await this.accountDataSource.setEmailVerificationSentDate({
      ...args,
      sentOn: new Date(),
    });
  }
}
