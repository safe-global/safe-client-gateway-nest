import {
  AddressBook,
  AddressBookItem,
} from '@/routes/accounts/address-books/entities/address-book.entity';
import { AddressBook as DomainAddressBook } from '@/domain/accounts/address-books/entities/address-book.entity';
import { AddressBookItem as DomainAddressBookItem } from '@/domain/accounts/address-books/entities/address-book.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IAddressBooksRepository } from '@/domain/accounts/address-books/address-books.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { UpdateAddressBookItemDto } from '@/routes/accounts/address-books/entities/update-address-book-item.dto.entity';

@Injectable()
export class AddressBooksService {
  constructor(
    @Inject(IAddressBooksRepository)
    private readonly repository: IAddressBooksRepository,
  ) {}

  async getAddressBook(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
  }): Promise<AddressBook> {
    const domainAddressBook = await this.repository.getAddressBook(args);
    return this.mapAddressBook(domainAddressBook);
  }

  async createAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const domainAddressBookItem =
      await this.repository.createAddressBookItem(args);
    return this.mapAddressBookItem(domainAddressBookItem);
  }

  async updateAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    addressBookItemId: number;
    updateAddressBookItemDto: UpdateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const domainAddressBookItem = await this.repository.updateAddressBookItem({
      ...args,
      updateAddressBookItemDto: {
        id: args.addressBookItemId,
        name: args.updateAddressBookItemDto.name,
        address: args.updateAddressBookItemDto.address,
      },
    });
    return this.mapAddressBookItem(domainAddressBookItem);
  }

  async deleteAddressBook(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
  }): Promise<void> {
    await this.repository.deleteAddressBook(args);
  }

  async deleteAddressBookItem(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    addressBookItemId: number;
  }): Promise<void> {
    await this.repository.deleteAddressBookItem(args);
  }

  private mapAddressBook(domainAddressBook: DomainAddressBook): AddressBook {
    return {
      id: domainAddressBook.id.toString(),
      accountId: domainAddressBook.accountId.toString(),
      chainId: domainAddressBook.chainId,
      data: domainAddressBook.data.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        address: item.address,
      })),
    };
  }

  private mapAddressBookItem(
    domainAddressBookItem: DomainAddressBookItem,
  ): AddressBookItem {
    return {
      id: domainAddressBookItem.id.toString(),
      name: domainAddressBookItem.name,
      address: domainAddressBookItem.address,
    };
  }
}
