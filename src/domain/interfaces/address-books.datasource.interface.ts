import type {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import type { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import type { UpdateAddressBookItemDto } from '@/domain/accounts/address-books/entities/update-address-book-item.dto.entity';
import type { Account } from '@/domain/accounts/entities/account.entity';

export const IAddressBooksDatasource = Symbol('IAddressBooksDatasource');

export interface IAddressBooksDatasource {
  createAddressBookItem(args: {
    account: Account;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  getAddressBook(args: {
    account: Account;
    chainId: string;
  }): Promise<AddressBook>;

  updateAddressBookItem(args: {
    addressBook: AddressBook;
    updateAddressBookItemDto: UpdateAddressBookItemDto;
  }): Promise<AddressBookItem>;

  deleteAddressBook(addressBook: AddressBook): Promise<void>;

  deleteAddressBookItem(args: {
    addressBook: AddressBook;
    id: number;
  }): Promise<void>;
}
