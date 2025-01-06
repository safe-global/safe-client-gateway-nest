import { AddressBook as DbAddressBook } from '@/datasources/accounts/address-books/entities/address-book.entity';
import { EncryptedBlob } from '@/datasources/accounts/encryption/entities/encrypted-blob.entity';
import { convertToDate } from '@/datasources/common/utils';
import {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import { IEncryptionApiManager } from '@/domain/interfaces/encryption-api.manager.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AddressBookDbMapper {
  constructor(
    @Inject(IEncryptionApiManager)
    private readonly encryptionApiManager: IEncryptionApiManager,
  ) {}

  async map(addressBook: DbAddressBook): Promise<AddressBook> {
    const encryptionApi = await this.encryptionApiManager.getApi();
    const decryptedData = await encryptionApi.decryptBlob<
      Array<AddressBookItem>
    >(
      new EncryptedBlob({
        encryptedData: addressBook.data,
        encryptedDataKey: addressBook.key,
        iv: addressBook.iv,
      }),
    );
    return {
      id: addressBook.id,
      accountId: addressBook.account_id,
      chainId: addressBook.chain_id,
      data: decryptedData,
      created_at: convertToDate(addressBook.created_at),
      updated_at: convertToDate(addressBook.updated_at),
    };
  }
}
