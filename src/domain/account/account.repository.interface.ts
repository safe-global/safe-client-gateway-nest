export const IAccountRepository = Symbol('IAccountRepository');

export interface IAccountRepository {
  /**
   * Gets the verified emails associated with a Safe address.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   */
  getVerifiedEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string[]>;

  /**
   * Creates a new account.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address which we should create the account for
   * @param args.emailAddress - the email address to store
   * @param args.signer - the owner address to which we should link the account to
   */
  createAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void>;

  /**
   * Resends the email verification code for an email registration
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.signer - the owner address to which we should link the email address to
   *
   * @throws {EmailAlreadyVerifiedError} - if the email is already verified
   * @throws {ResendVerificationTimespanError} -
   * if trying to trigger a resend within email.verificationCode.resendLockWindowMs
   * @throws {InvalidVerificationCodeError} - if a verification code was not set
   */
  resendEmailVerification(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void>;

  /**
   * Verifies an email address with the provided code.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.signer - the owner address to which we should link the email address to
   * @param args.code - the user-provided code to validate the email verification
   *
   * @throws {InvalidVerificationCodeError} - if the verification code does not match the expected one
   * @throws {InvalidVerificationCodeError} - if the verification code expired
   */
  verifyEmailAddress(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
  }): Promise<any>;

  /**
   * Deletes an account.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the account to be removed
   * @param args.signer - the signer address of the account to be removed
   */
  deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void>;

  /**
   * Edits an email entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which we should store the email address
   * @param args.emailAddress - the email address to store
   * @param args.signer - the owner address to which we should link the email address to
   *
   * @throws {EditTimespanError} - if trying to edit again within email.verificationCode.resendLockWindowMs
   * @throws {EmailEditMatchesError} - if trying to apply edit with same email address as current one
   */
  editEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<void>;
}
