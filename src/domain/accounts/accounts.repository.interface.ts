import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { AccountsRepository } from '@/domain/accounts/accounts.repository';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account } from '@/domain/accounts/entities/account.entity';
import { CreateAccountDto } from '@/domain/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Module } from '@nestjs/common';
import { Request } from 'express';

export const IAccountsRepository = Symbol('IAccountsRepository');

export interface IAccountsRepository {
  createAccount(args: {
    authPayload: AuthPayload;
    createAccountDto: CreateAccountDto;
    clientIp: Request['ip'];
  }): Promise<Account>;

  getAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account>;

  deleteAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void>;

  getDataTypes(): Promise<Array<AccountDataType>>;

  getAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Array<AccountDataSetting>>;

  upsertAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<Array<AccountDataSetting>>;
}

@Module({
  imports: [AccountsDatasourceModule],
  providers: [
    {
      provide: IAccountsRepository,
      useClass: AccountsRepository,
    },
  ],
  exports: [IAccountsRepository],
})
export class AccountsRepositoryModule {}
