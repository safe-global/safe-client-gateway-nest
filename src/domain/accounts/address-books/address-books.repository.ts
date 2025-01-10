import { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import type { IAddressBooksRepository } from '@/domain/accounts/address-books/address-books.repository.interface';
import type {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { UpdateAddressBookItemDto } from '@/domain/accounts/address-books/entities/update-address-book-item.dto.entity';
import {
  AccountDataType,
  AccountDataTypeNames,
} from '@/domain/accounts/entities/account-data-type.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAddressBooksDatasource } from '@/domain/interfaces/address-books.datasource.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  GoneException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AddressBooksRepository implements IAddressBooksRepository {
  constructor(
    @Inject(IAddressBooksDatasource)
    private readonly datasource: IAddressBooksDatasource,
    @Inject(IAccountsRepository)
    private readonly accountsRepository: IAccountsRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Gets an AddressBook.
   * Checks that the account has the AddressBooks Data Setting enabled.
   */
  async getAddressBook(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
  }): Promise<AddressBook> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkAddressBooksIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    return await this.datasource.getAddressBook({
      account,
      chainId: args.chainId,
    });
  }

  /**
   * Creates an AddressBookItem.
   * Checks that the account has the AddressBooks Data Setting enabled.
   *
   * If an AddressBook for the Account and chainId does not exist, it's created.
   */
  async createAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkAddressBooksIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    // TODO: implement a configurable MAX_ADDRESS_BOOK_ITEMS limitation.
    return this.datasource.createAddressBookItem({
      account,
      chainId: args.chainId,
      createAddressBookItemDto: args.createAddressBookItemDto,
    });
  }

  /**
   * Updates an AddressBookItem.
   * Checks that the account has the AddressBooks Data Setting enabled.
   *
   * If an AddressBook for the Account and chainId does not exist,
   * an AddressBookNotFound error is thrown.
   */
  async updateAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    updateAddressBookItemDto: UpdateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException(
        `Unauthorized: Signer address does not match requested address.`,
      );
    }
    await this.checkAddressBooksIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    const addressBook = await this.datasource.getAddressBook({
      account,
      chainId: args.chainId,
    });
    return this.datasource.updateAddressBookItem({
      addressBook,
      updateAddressBookItemDto: args.updateAddressBookItemDto,
    });
  }

  async deleteAddressBook(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
  }): Promise<void> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkAddressBooksIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    const addressBook = await this.datasource.getAddressBook({
      account,
      chainId: args.chainId,
    });
    return this.datasource.deleteAddressBook(addressBook);
  }

  async deleteAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    addressBookItemId: number;
  }): Promise<void> {
    if (!args.authPayload.isForSigner(args.address)) {
      throw new UnauthorizedException();
    }
    await this.checkAddressBooksIsEnabled({
      authPayload: args.authPayload,
      address: args.address,
    });
    const account = await this.accountsRepository.getAccount({
      authPayload: args.authPayload,
      address: args.address,
    });
    const addressBook = await this.datasource.getAddressBook({
      account,
      chainId: args.chainId,
    });
    return this.datasource.deleteAddressBookItem({
      addressBook,
      id: args.addressBookItemId,
    });
  }

  // TODO: Extract this functionality in AccountsRepository['checkIsEnabled(DataType, Account)']
  private async checkAddressBooksIsEnabled(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    const addressBookDataType = await this.checkAddressBookDataTypeIsActive();
    const accountDataSettings =
      await this.accountsRepository.getAccountDataSettings({
        authPayload: args.authPayload,
        address: args.address,
      });
    const addressBookSetting = accountDataSettings.find(
      (setting) => setting.account_data_type_id === addressBookDataType.id,
    );
    if (!addressBookSetting?.enabled) {
      this.loggingService.warn({
        message: `Account ${args.address} does not have AddressBooks enabled`,
      });
      throw new GoneException();
    }
  }

  // TODO: Extract this functionality in AccountsRepository['checkIsActive(DataType)']
  private async checkAddressBookDataTypeIsActive(): Promise<AccountDataType> {
    const dataTypes = await this.accountsRepository.getDataTypes();
    const addressBookDataType = dataTypes.find(
      (dataType) => dataType.name === AccountDataTypeNames.AddressBook,
    );
    if (!addressBookDataType?.is_active) {
      this.loggingService.warn({
        message: `${AccountDataTypeNames.AddressBook} data type is not active`,
      });
      throw new GoneException();
    }
    return addressBookDataType;
  }
}
