import { AddressBooksDatasourceModule } from '@/datasources/accounts/address-books/address-books.datasource.module';
import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { AddressBooksRepository } from '@/domain/accounts/address-books/address-books.repository';
import type {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { UpdateAddressBookItemDto } from '@/domain/accounts/address-books/entities/update-address-book-item.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Module } from '@nestjs/common';

export const IAddressBooksRepository = Symbol.for('IAddressBooksRepository');

export interface IAddressBooksRepository {
  getAddressBook(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
  }): Promise<AddressBook>;

  createAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  updateAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    updateAddressBookItemDto: UpdateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  deleteAddressBook(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
  }): Promise<void>;

  deleteAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    addressBookItemId: number;
  }): Promise<void>;
}

@Module({
  imports: [AccountsRepositoryModule, AddressBooksDatasourceModule],
  providers: [
    {
      provide: IAddressBooksRepository,
      useClass: AddressBooksRepository,
    },
  ],
  exports: [IAddressBooksRepository],
})
export class AddressBooksRepositoryModule {}
