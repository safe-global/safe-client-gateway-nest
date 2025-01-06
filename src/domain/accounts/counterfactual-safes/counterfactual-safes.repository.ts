import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import { ICounterfactualSafesRepository } from '@/domain/accounts/counterfactual-safes/counterfactual-safes.repository.interface';
import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import {
  AccountDataType,
  AccountDataTypeNames,
} from '@/domain/accounts/entities/account-data-type.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import {
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class CounterfactualSafesRepository
  implements ICounterfactualSafesRepository
{
  constructor(
    @Inject(ICounterfactualSafesDatasource)
    private readonly datasource: ICounterfactualSafesDatasource,
    @Inject(IAccountsRepository)
    private readonly accountsRepository: IAccountsRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Gets a Counterfactual Safe.
   * Checks that the account has the CounterfactualSafes data setting enabled.
   */
  async getCounterfactualSafe(args: {
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<CounterfactualSafe> {
    return this.datasource.getCounterfactualSafe(args);
  }

  /**
   * Gets all the Counterfactual Safes associated with an account address.
   * Checks that the account has the CounterfactualSafes data setting enabled.
   */
  async getCounterfactualSafes(
    address: `0x${string}`,
  ): Promise<Array<CounterfactualSafe>> {
    return this.datasource.getCounterfactualSafesForAddress(address);
  }

  /**
   * Gets or creates a Counterfactual Safe.
   * Checks that the account has the CounterfactualSafes data setting enabled.
   *
   * If the Counterfactual Safe exists, it returns it.
   * If the Counterfactual Safe does not exist, it's created.
   */
  async createCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkCounterfactualSafesIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });

    try {
      return await this.datasource.getCounterfactualSafe({
        address: args.address,
        chainId: args.createCounterfactualSafeDto.chainId,
        predictedAddress: args.createCounterfactualSafeDto.predictedAddress,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        return this.datasource.createCounterfactualSafe({
          account,
          createCounterfactualSafeDto: args.createCounterfactualSafeDto,
        });
      }
      throw error;
    }
  }

  /**
   * Deletes a Counterfactual Safe.
   * Checks that the account has the CounterfactualSafes data setting enabled.
   */
  async deleteCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<void> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkCounterfactualSafesIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    return this.datasource.deleteCounterfactualSafe({
      account,
      chainId: args.chainId,
      predictedAddress: args.predictedAddress,
    });
  }

  /**
   * Deletes all the Counterfactual Safes created by the passed account address.
   * Checks that the account has the CounterfactualSafes data setting enabled.
   */
  async deleteCounterfactualSafes(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkCounterfactualSafesIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    return this.datasource.deleteCounterfactualSafesForAccount(account);
  }

  // TODO: Extract this functionality in AccountsRepository['checkIsEnabled(DataType, Account)']
  private async checkCounterfactualSafesIsEnabled(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    const counterfactualSafeDataType =
      await this.checkCounterfactualSafeDataTypeIsActive();
    const accountDataSettings =
      await this.accountsRepository.getAccountDataSettings({
        authPayload: args.authPayload,
        address: args.address,
      });
    const counterfactualSafeSetting = accountDataSettings.find(
      (setting) =>
        setting.account_data_type_id === counterfactualSafeDataType.id,
    );
    if (!counterfactualSafeSetting?.enabled) {
      this.loggingService.warn({
        message: `Account ${args.address} does not have CounterfactualSafes enabled`,
      });
      throw new GoneException();
    }
  }

  // TODO: Extract this functionality in AccountsRepository['checkIsActive(DataType)']
  private async checkCounterfactualSafeDataTypeIsActive(): Promise<AccountDataType> {
    const dataTypes = await this.accountsRepository.getDataTypes();
    const counterfactualSafeDataType = dataTypes.find(
      (dataType) => dataType.name === AccountDataTypeNames.CounterfactualSafes,
    );
    if (!counterfactualSafeDataType?.is_active) {
      this.loggingService.warn({
        message: `${AccountDataTypeNames.CounterfactualSafes} data type is not active`,
      });
      throw new GoneException();
    }
    return counterfactualSafeDataType;
  }
}
