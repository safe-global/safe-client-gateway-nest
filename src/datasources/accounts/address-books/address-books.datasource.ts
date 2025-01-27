import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import { AddressBook as DbAddressBook } from '@/datasources/accounts/address-books/entities/address-book.entity';
import {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { UpdateAddressBookItemDto } from '@/domain/accounts/address-books/entities/update-address-book-item.dto.entity';
import { AddressBookItemNotFoundError } from '@/domain/accounts/address-books/errors/address-book-item-not-found.error';
import { AddressBookNotFoundError } from '@/domain/accounts/address-books/errors/address-book-not-found.error';
import { Account } from '@/domain/accounts/entities/account.entity';
import { IAddressBooksDatasource } from '@/domain/interfaces/address-books.datasource.interface';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';
import max from 'lodash/max';
import postgres from 'postgres';

@Injectable()
export class AddressBooksDatasource implements IAddressBooksDatasource {
  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(IEncryptionApiManager)
    private readonly encryptionApiManager: IEncryptionApiManager,
    private readonly addressBookMapper: AddressBookDbMapper,
  ) {}

  async createAddressBookItem(args: {
    account: Account;
    chainId: string;
    createAddressBookItemDto: CreateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const addressBook = await this.getOrCreateAddressBook(
      args.account,
      args.chainId,
    );
    const addressBookItem = {
      id: (max(addressBook.data.map((i) => i.id)) ?? 0) + 1,
      address: args.createAddressBookItemDto.address,
      name: args.createAddressBookItemDto.name,
    };
    addressBook.data.push(addressBookItem);
    await this.updateAddressBook(addressBook);
    return addressBookItem;
  }

  async getAddressBook(args: {
    account: Account;
    chainId: string;
  }): Promise<AddressBook> {
    const [dbAddressBook] = await this.sql<
      Array<DbAddressBook>
    >`SELECT * FROM address_books WHERE account_id = ${args.account.id} AND chain_id = ${args.chainId}`;
    if (!dbAddressBook) throw new AddressBookNotFoundError();
    return this.addressBookMapper.map(dbAddressBook);
  }

  async updateAddressBookItem(args: {
    addressBook: AddressBook;
    updateAddressBookItemDto: UpdateAddressBookItemDto;
  }): Promise<AddressBookItem> {
    const { addressBook, updateAddressBookItemDto } = args;
    const addressBookItem = addressBook.data.find(
      (i) => i.id === updateAddressBookItemDto.id,
    );
    if (!addressBookItem) throw new AddressBookItemNotFoundError();
    addressBookItem.address = updateAddressBookItemDto.address;
    addressBookItem.name = updateAddressBookItemDto.name;
    await this.updateAddressBook(addressBook);
    return addressBookItem;
  }

  async deleteAddressBook(addressBook: AddressBook): Promise<void> {
    await this.sql`DELETE FROM address_books WHERE id = ${addressBook.id}`;
  }

  async deleteAddressBookItem(args: {
    addressBook: AddressBook;
    id: number;
  }): Promise<void> {
    const { addressBook, id } = args;
    const index = addressBook.data.findIndex((i) => i.id === id);
    if (index === -1) throw new AddressBookItemNotFoundError();
    addressBook.data.splice(index, 1);
    await this.updateAddressBook(addressBook);
  }

  private async getOrCreateAddressBook(
    account: Account,
    chainId: string,
  ): Promise<AddressBook> {
    try {
      return await this.getAddressBook({ account, chainId });
    } catch (err) {
      if (err instanceof AddressBookNotFoundError) {
        return this.addressBookMapper.map(
          await this.createAddressBook({ account, chainId }),
        );
      }
      throw err;
    }
  }

  private async createAddressBook(args: {
    account: Account;
    chainId: string;
  }): Promise<DbAddressBook> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const encryptedBlob = await encryptionApi.encryptBlob([]);
    const [dbAddressBook] = await this.sql<Array<DbAddressBook>>`
      INSERT INTO address_books (account_id, chain_id, data, key, iv)
      VALUES (
        ${args.account.id},
        ${args.chainId},
        ${encryptedBlob.encryptedData},
        ${encryptedBlob.encryptedDataKey},
        ${encryptedBlob.iv}
      ) RETURNING *;
    `;
    return dbAddressBook;
  }

  private async updateAddressBook(
    addressBook: AddressBook,
  ): Promise<DbAddressBook> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const encryptedBlob = await encryptionApi.encryptBlob(addressBook.data);
    const [dbAddressBook] = await this.sql<Array<DbAddressBook>>`
      UPDATE address_books
      SET data = ${encryptedBlob.encryptedData},
          key = ${encryptedBlob.encryptedDataKey},
          iv = ${encryptedBlob.iv}
      WHERE id = ${addressBook.id}
     RETURNING *;
    `;
    return dbAddressBook;
  }
}
