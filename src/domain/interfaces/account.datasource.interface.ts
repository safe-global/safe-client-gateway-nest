import {
  Account,
  EmailAddress,
} from '@/domain/account/entities/account.entity';
import { Subscription } from '@/domain/account/entities/subscription.entity';

export const IAccountDataSource = Symbol('IAccountDataSource');

export interface IAccountDataSource {
  /**
   * Gets the verified emails associated with a Safe address.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to use as filter
   */
  getVerifiedAccountEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ email: string }[]>;

  /**
   * Gets the account associated with a signer/owner of a Safe for a specific chain.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the account
   * @param args.signer - the signer/owner address of the account
   */
  getAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Account>;

  /**
   * Creates a new account entry
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.emailAddress - the email address of the signer/owner
   * @param args.signer - the signer/owner address of the account
   * @param args.code - the generated code to be used to verify this email address
   * @param args.verificationGeneratedOn – the date which represents when the code was generated
   */
  createAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    signer: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void>;

  /**
   * Sets the verification code for an account.
   *
   * If the reset was successful, the new verification code is returned.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.signer - the signer/owner address of the account
   * @param args.code - the generated code to be used to verify this email address
   * @param args.verificationGeneratedOn – the date which represents when the code was generated
   */
  setEmailVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
    codeGenerationDate: Date;
  }): Promise<void>;

  /**
   * Sets the verification date for an email entry.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.signer - the signer/owner address of the account
   * @param args.sent_on - the verification-sent date
   */
  setEmailVerificationSentDate(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    sentOn: Date;
  }): Promise<void>;

  /**
   * Verifies the email address for an account of a Safe.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.signer - the signer/owner address of the account
   */
  verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void>;

  /**
   * Deletes the given account.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.signer - the signer/owner address of the account
   */
  deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void>;

  /**
   * Updates the email address of an account.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.emailAddress - the email address to store
   * @param args.signer - the signer/owner address of the account
   * @param args.code - the generated code to be used to verify this email address
   * @param args.verificationGeneratedOn – the date which represents when the code was generated
   */
  updateAccountEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    signer: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void>;

  /**
   * Gets all the subscriptions for the account on chainId, with the specified safeAddress.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address of the signer/owner
   * @param args.signer - the signer/owner address of the account
   */
  getSubscriptions(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Subscription[]>;

  /**
   * Subscribes the account on chainId, with the safeAddress to a type of notification.
   *
   * @param args.chainId - the chain id of where the Safe is deployed
   * @param args.safeAddress - the Safe address to which the email address is linked to
   * @param args.signer - the signer/owner address of the account
   * @param args.notificationTypeKey - the category key to subscribe to
   *
   * @returns The Subscriptions that were successfully subscribed to
   */
  subscribe(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    notificationTypeKey: string;
  }): Promise<Subscription[]>;

  /**
   * Unsubscribes from the notification type with the provided category key.
   *
   * If the category key or the token are incorrect, no subscriptions are returned from this call.
   *
   * @param args.notificationTypeKey - the category key to unsubscribe
   * @param args.token - the unsubscription token (tied to a single account)
   *
   * @returns The Subscriptions that were successfully unsubscribed.
   */
  unsubscribe(args: {
    notificationTypeKey: string;
    token: string;
  }): Promise<Subscription[]>;

  /**
   * Unsubscribes from all notification categories.
   *
   * If the provided token is incorrect, no subscriptions are returned from this call.
   *
   * @param args.token - the unsubscription token (tied to a single account)
   *
   * @returns The Subscriptions that were successfully unsubscribed.
   */
  unsubscribeAll(args: { token: string }): Promise<Subscription[]>;
}
