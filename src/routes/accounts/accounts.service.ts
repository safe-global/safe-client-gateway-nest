import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { AccountDataSetting as DomainAccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { AccountDataType as DomainAccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { Account as DomainAccount } from '@/domain/accounts/entities/account.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { AccountDataSetting } from '@/routes/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/routes/accounts/entities/account-data-type.entity';
import { Account } from '@/routes/accounts/entities/account.entity';
import { CreateAccountDto } from '@/routes/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDto } from '@/routes/accounts/entities/upsert-account-data-settings.dto.entity';
import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(IAccountsRepository)
    private readonly accountsRepository: IAccountsRepository,
  ) {}

  async createAccount(args: {
    authPayload: AuthPayload;
    createAccountDto: CreateAccountDto;
    clientIp: Request['ip'];
  }): Promise<Account> {
    const domainAccount = await this.accountsRepository.createAccount({
      authPayload: args.authPayload,
      createAccountDto: args.createAccountDto,
      clientIp: args.clientIp,
    });
    return this.mapAccount(domainAccount);
  }

  async getAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Account> {
    const domainAccount = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    return this.mapAccount(domainAccount);
  }

  async deleteAccount(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    await this.accountsRepository.deleteAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
  }

  async getDataTypes(): Promise<Array<AccountDataType>> {
    const domainDataTypes = await this.accountsRepository.getDataTypes();
    return domainDataTypes.map((domainDataType) =>
      this.mapDataType(domainDataType),
    );
  }

  async getAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<Array<AccountDataSetting>> {
    const [domainAccountDataSettings, dataTypes] = await Promise.all([
      this.accountsRepository.getAccountDataSettings({
        authPayload: args.authPayload,
        address: args.address,
      }),
      this.accountsRepository.getDataTypes(),
    ]);

    return domainAccountDataSettings.map((domainAccountDataSetting) =>
      this.mapDataSetting(dataTypes, domainAccountDataSetting),
    );
  }

  async upsertAccountDataSettings(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto;
  }): Promise<Array<AccountDataSetting>> {
    const [domainAccountDataSettings, dataTypes] = await Promise.all([
      this.accountsRepository.upsertAccountDataSettings({
        authPayload: args.authPayload,
        address: args.address,
        upsertAccountDataSettingsDto: {
          accountDataSettings:
            args.upsertAccountDataSettingsDto.accountDataSettings,
        },
      }),
      this.accountsRepository.getDataTypes(),
    ]);

    return domainAccountDataSettings.map((domainAccountDataSetting) =>
      this.mapDataSetting(dataTypes, domainAccountDataSetting),
    );
  }

  private mapAccount(domainAccount: DomainAccount): Account {
    return new Account(
      domainAccount.id.toString(),
      domainAccount.group_id?.toString() ?? null,
      domainAccount.address,
      domainAccount.name,
    );
  }

  private mapDataType(domainDataType: DomainAccountDataType): AccountDataType {
    return new AccountDataType(
      domainDataType.id.toString(),
      domainDataType.name,
      domainDataType.description?.toString() ?? null,
      domainDataType.is_active,
    );
  }

  private mapDataSetting(
    dataTypes: Array<DomainAccountDataType>,
    domainAccountDataSetting: DomainAccountDataSetting,
  ): AccountDataSetting {
    const dataType = dataTypes.find(
      (dt) => dt.id === domainAccountDataSetting.account_data_type_id,
    );

    if (!dataType) {
      throw new Error('Data type not found');
    }

    return {
      dataTypeId: dataType.id.toString(),
      enabled: domainAccountDataSetting.enabled,
    };
  }
}
