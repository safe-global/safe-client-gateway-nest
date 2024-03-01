import { Inject, Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { AccountDoesNotExistError } from '@/datasources/account/errors/account-does-not-exist.error';
import {
  Account as DomainAccount,
  EmailAddress,
} from '@/domain/account/entities/account.entity';
import { Subscription as DomainSubscription } from '@/domain/account/entities/subscription.entity';

interface Account {
  id: number;
  chain_id: number;
  email_address: string;
  safe_address: string;
  signer: string;
  verified: boolean;
  verification_code: string | null;
  verification_code_generated_on: Date | null;
  verification_sent_on: Date | null;
  unsubscription_token: string;
}

interface Subscription {
  id: number;
  key: string;
  name: string;
}

@Injectable()
export class AccountDataSource implements IAccountDataSource {
  constructor(@Inject('DB_INSTANCE') private readonly sql: postgres.Sql) {}

  async getVerifiedAccountEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ email: string }[]> {
    const emails = await this.sql<{ email_address: string }[]>`
        SELECT email_address
        FROM accounts
        WHERE chain_id = ${args.chainId}
          AND safe_address = ${args.safeAddress}
          AND verified is true
        ORDER by id`;

    return emails.map((email) => ({ email: email.email_address }));
  }

  async getAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<DomainAccount> {
    const [account] = await this.sql<Account[]>`SELECT *
                                                FROM accounts
                                                WHERE chain_id = ${args.chainId}
                                                  AND safe_address = ${args.safeAddress}
                                                  AND signer = ${args.signer}`;
    if (!account) {
      throw new AccountDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }

    return {
      chainId: account.chain_id.toString(),
      emailAddress: new EmailAddress(account.email_address),
      isVerified: account.verified,
      safeAddress: account.safe_address,
      signer: account.signer,
      verificationCode: account.verification_code,
      verificationGeneratedOn: account.verification_code_generated_on,
      verificationSentOn: account.verification_sent_on,
    };
  }

  async createAccount(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    signer: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void> {
    await this.sql<Account[]>`
        INSERT INTO accounts (chain_id, email_address, safe_address, signer, verification_code,
                              verification_code_generated_on, unsubscription_token)
        VALUES (${args.chainId}, ${args.emailAddress.value}, ${args.safeAddress}, ${args.signer}, ${args.code},
                ${args.codeGenerationDate}, ${args.unsubscriptionToken})
        RETURNING *
    `;
  }

  async setEmailVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
    codeGenerationDate: Date;
  }): Promise<void> {
    const [account] = await this.sql<Account[]>`UPDATE accounts
                                                SET verification_code              = ${args.code},
                                                    verification_code_generated_on = ${args.codeGenerationDate}
                                                WHERE chain_id = ${args.chainId}
                                                  AND safe_address = ${args.safeAddress}
                                                  AND signer = ${args.signer}
                                                RETURNING *`;

    if (!account) {
      throw new AccountDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async setEmailVerificationSentDate(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    sentOn: Date;
  }): Promise<void> {
    const [account] = await this.sql<Account[]>`UPDATE accounts
                                                SET verification_sent_on = ${args.sentOn}
                                                WHERE chain_id = ${args.chainId}
                                                  AND safe_address = ${args.safeAddress}
                                                  AND signer = ${args.signer}
                                                RETURNING *`;

    if (!account) {
      throw new AccountDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    const [account] = await this.sql<Account[]>`UPDATE accounts
                                                SET verified          = true,
                                                    verification_code = null
                                                WHERE chain_id = ${args.chainId}
                                                  AND safe_address = ${args.safeAddress}
                                                  AND signer = ${args.signer}
                                                RETURNING *`;

    if (!account) {
      throw new AccountDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async deleteAccount(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    const [account] = await this.sql<Account[]>`DELETE
                                                FROM accounts
                                                WHERE chain_id = ${args.chainId}
                                                  AND safe_address = ${args.safeAddress}
                                                  AND signer = ${args.signer}
                                                RETURNING *`;

    if (!account) {
      throw new AccountDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async updateAccountEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    signer: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void> {
    const [account] = await this.sql<Account[]>`UPDATE accounts
                                                SET email_address                  = ${args.emailAddress.value},
                                                    verified                       = false,
                                                    verification_code              = ${args.code},
                                                    verification_code_generated_on = ${args.codeGenerationDate},
                                                    unsubscription_token           = ${args.unsubscriptionToken}
                                                WHERE chain_id = ${args.chainId}
                                                  AND safe_address = ${args.safeAddress}
                                                  AND signer = ${args.signer}
                                                RETURNING *`;

    if (!account) {
      throw new AccountDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async getSubscriptions(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<DomainSubscription[]> {
    const subscriptions = await this.sql`SELECT key, name
                                         FROM notification_types
                                                  INNER JOIN subscriptions subs
                                                             on notification_types.id = subs.notification_type
                                                  INNER JOIN accounts emails on emails.id = subs.account_id
                                         WHERE chain_id = ${args.chainId}
                                           AND safe_address = ${args.safeAddress}
                                           AND signer = ${args.signer}`;
    return subscriptions.map((subscription) => ({
      key: subscription.key,
      name: subscription.name,
    }));
  }

  async subscribe(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    notificationTypeKey: string;
  }): Promise<DomainSubscription[]> {
    const subscriptions = await this
      .sql`INSERT INTO subscriptions (account_id, notification_type)
               (SELECT accounts.id           AS account_id,
                       notification_types.id AS subscription_id
                FROM accounts
                         CROSS JOIN notification_types
                WHERE accounts.chain_id = ${args.chainId}
                  AND accounts.safe_address = ${args.safeAddress}
                  AND accounts.signer = ${args.signer}
                  AND notification_types.key = ${args.notificationTypeKey})
           RETURNING *`;

    return subscriptions.map((s) => ({
      key: s.key,
      name: s.name,
    }));
  }

  async unsubscribe(args: {
    notificationTypeKey: string;
    token: string;
  }): Promise<DomainSubscription[]> {
    const subscriptions = await this.sql<Subscription[]>`DELETE
                                                         FROM subscriptions
                                                             USING accounts, notification_types
                                                         WHERE accounts.unsubscription_token = ${args.token}
                                                           AND notification_types.key = ${args.notificationTypeKey}
                                                           AND subscriptions.account_id = accounts.id
                                                           AND subscriptions.notification_type = notification_types.id
                                                         RETURNING notification_types.key, notification_types.name`;
    return subscriptions.map((s) => ({
      key: s.key,
      name: s.name,
    }));
  }

  async unsubscribeAll(args: { token: string }): Promise<DomainSubscription[]> {
    const subscriptions = await this.sql`
        WITH deleted_subscriptions AS (
            DELETE FROM subscriptions
                WHERE account_id = (SELECT id
                                    FROM accounts
                                    WHERE unsubscription_token = ${args.token})
                RETURNING notification_type)
        SELECT subs.key, subs.name
        FROM notification_types subs
                 JOIN deleted_subscriptions deleted_subs ON subs.id = deleted_subs.notification_type
    `;

    return subscriptions.map((s) => ({
      key: s.key,
      name: s.name,
    }));
  }
}
