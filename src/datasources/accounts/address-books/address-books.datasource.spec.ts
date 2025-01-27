import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AddressBooksDatasource } from '@/datasources/accounts/address-books/address-books.datasource';
import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import type { EncryptionApiManager } from '@/datasources/accounts/encryption/encryption-api.manager';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { createAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/create-address-book-item.dto.builder';
import { updateAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/update-address-book-item.dto.builder';
import { createAccountDtoBuilder } from '@/domain/accounts/entities/__tests__/create-account.dto.builder';
import type { Account } from '@/domain/accounts/entities/account.entity';
import { faker } from '@faker-js/faker/.';
import { randomBytes } from 'crypto';
import type postgres from 'postgres';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockEncryptionApiManager = jest.mocked({
  getApi: jest.fn(),
} as jest.MockedObjectDeep<EncryptionApiManager>);

describe('AddressBooksDataSource', () => {
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: AddressBooksDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'application.isProduction') return false;
      if (key === 'accounts.encryption.local.algorithm') return 'aes-256-cbc';
      if (key === 'accounts.encryption.local.key')
        return randomBytes(32).toString('hex');
      if (key === 'accounts.encryption.local.iv')
        return randomBytes(16).toString('hex');
    });
    mockEncryptionApiManager.getApi.mockResolvedValue(
      new LocalEncryptionApiService(mockConfigurationService),
    );

    target = new AddressBooksDatasource(
      sql,
      mockEncryptionApiManager,
      new AddressBookDbMapper(mockEncryptionApiManager),
    );
  });

  beforeEach(async () => {
    await sql`TRUNCATE TABLE accounts, account_data_settings, address_books CASCADE`;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  const createTestAccount = async (): Promise<Account> => {
    const createAccountDto = createAccountDtoBuilder().build();
    const [account] = await sql<Array<Account>>`
        INSERT INTO accounts (address, name, name_hash)
        VALUES (
          ${createAccountDto.address},
          ${createAccountDto.name},
          ${faker.string.alphanumeric(32)}
        ) RETURNING *`;
    return account;
  };

  describe('createAddressBookItem', () => {
    it('should create an address book if it does not exist when adding a new item', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();

      const addressBookItem = await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto,
      });

      expect(addressBookItem).toMatchObject({
        id: expect.any(Number),
        address: createAddressBookItemDto.address,
        name: createAddressBookItemDto.name,
      });
      expect(await target.getAddressBook({ account, chainId })).toMatchObject({
        data: [createAddressBookItemDto],
        accountId: account.id,
        chainId,
      });
    });

    it('should create a several address book items', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto: createAddressBookItemDtoArray[0],
      });
      expect(await target.getAddressBook({ account, chainId })).toMatchObject({
        data: [createAddressBookItemDtoArray[0]],
        accountId: account.id,
      });
      await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto: createAddressBookItemDtoArray[1],
      });
      expect(await target.getAddressBook({ account, chainId })).toMatchObject({
        data: [
          createAddressBookItemDtoArray[0],
          createAddressBookItemDtoArray[1],
        ],
        accountId: account.id,
        chainId,
      });
      await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto: createAddressBookItemDtoArray[2],
      });
      expect(await target.getAddressBook({ account, chainId })).toMatchObject({
        data: createAddressBookItemDtoArray,
        accountId: account.id,
        chainId,
      });
    });
  });

  describe('getAddressBook', () => {
    it('should throw an error if the address book does not exist', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();

      await expect(target.getAddressBook({ account, chainId })).rejects.toThrow(
        'Address Book not found',
      );
    });

    it('should return the address book if it exists', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();
      await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto,
      });

      const addressBook = await target.getAddressBook({ account, chainId });

      expect(addressBook).toMatchObject({
        data: [createAddressBookItemDto],
        accountId: account.id,
        chainId,
      });
    });
  });

  describe('updateAddressBookItem', () => {
    it('should update an address book item', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();
      const createdAddressBookItem = await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto,
      });
      const updatedAddressBookItem = updateAddressBookItemDtoBuilder()
        .with('id', createdAddressBookItem.id)
        .build();

      const addressBook = await target.getAddressBook({ account, chainId });
      const updatedItem = await target.updateAddressBookItem({
        addressBook,
        updateAddressBookItemDto: updatedAddressBookItem,
      });

      expect(updatedItem).toMatchObject(updatedAddressBookItem);
      expect(await target.getAddressBook({ account, chainId })).toMatchObject({
        data: [updatedAddressBookItem],
        accountId: account.id,
        chainId,
      });
    });

    it('should update one address book item', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const firstCreatedItem = await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto: createAddressBookItemDtoBuilder().build(),
      });
      const secondCreatedItem = await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto: createAddressBookItemDtoBuilder().build(),
      });
      const updatedAddressBookItem = updateAddressBookItemDtoBuilder()
        .with('id', secondCreatedItem.id)
        .build();

      const addressBook = await target.getAddressBook({ account, chainId });
      const updatedItem = await target.updateAddressBookItem({
        addressBook,
        updateAddressBookItemDto: updatedAddressBookItem,
      });

      expect(updatedItem).toMatchObject(updatedAddressBookItem);
      expect(await target.getAddressBook({ account, chainId })).toMatchObject({
        data: [firstCreatedItem, updatedAddressBookItem],
        accountId: account.id,
        chainId,
      });
    });

    it('should throw an error if the address book item does not exist', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      for (const createAddressBookItemDto of createAddressBookItemDtoArray) {
        await target.createAddressBookItem({
          account,
          chainId,
          createAddressBookItemDto,
        });
      }
      const addressBook = await target.getAddressBook({ account, chainId });
      const nonExistentId = addressBook.data.reduce((sum, i) => sum + i.id, 1);

      await expect(
        target.updateAddressBookItem({
          addressBook,
          updateAddressBookItemDto: updateAddressBookItemDtoBuilder()
            .with('id', nonExistentId)
            .build(),
        }),
      ).rejects.toThrow('Address Book Item not found');
    });
  });

  describe('deleteAddressBook', () => {
    it('should delete an address book', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto: createAddressBookItemDtoBuilder().build(),
      });
      const addressBook = await target.getAddressBook({ account, chainId });

      await target.deleteAddressBook(addressBook);

      await expect(target.getAddressBook({ account, chainId })).rejects.toThrow(
        'Address Book not found',
      );
    });
  });

  describe('deleteAddressBookItem', () => {
    it('should delete the first address book item', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      for (const createAddressBookItemDto of createAddressBookItemDtoArray) {
        await target.createAddressBookItem({
          account,
          chainId,
          createAddressBookItemDto,
        });
      }
      const addressBook = await target.getAddressBook({ account, chainId });
      const items = Object.values(addressBook.data);

      await target.deleteAddressBookItem({
        addressBook,
        id: addressBook.data[0].id,
      });

      const afterDeletion = await target.getAddressBook({ account, chainId });
      expect(afterDeletion).toMatchObject({
        data: [items[1], items[2]],
        accountId: account.id,
        chainId,
      });
    });

    it('should delete an address book item', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      for (const createAddressBookItemDto of createAddressBookItemDtoArray) {
        await target.createAddressBookItem({
          account,
          chainId,
          createAddressBookItemDto,
        });
      }
      const addressBook = await target.getAddressBook({ account, chainId });
      const items = Object.values(addressBook.data);

      await target.deleteAddressBookItem({
        addressBook,
        id: addressBook.data[1].id,
      });

      const afterDeletion = await target.getAddressBook({ account, chainId });
      expect(afterDeletion).toMatchObject({
        data: [items[0], items[2]],
        accountId: account.id,
        chainId,
      });
    });

    it('should delete the last address book item', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      for (const createAddressBookItemDto of createAddressBookItemDtoArray) {
        await target.createAddressBookItem({
          account,
          chainId,
          createAddressBookItemDto,
        });
      }
      const addressBook = await target.getAddressBook({ account, chainId });
      const items = Object.values(addressBook.data);

      await target.deleteAddressBookItem({
        addressBook,
        id: addressBook.data[createAddressBookItemDtoArray.length - 1].id,
      });

      const afterDeletion = await target.getAddressBook({ account, chainId });
      expect(afterDeletion).toMatchObject({
        data: [items[0], items[1]],
        accountId: account.id,
        chainId,
      });
    });

    it('should create an address book with the proper id item after deletion', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      for (const createAddressBookItemDto of createAddressBookItemDtoArray) {
        await target.createAddressBookItem({
          account,
          chainId,
          createAddressBookItemDto,
        });
      }
      const addressBook = await target.getAddressBook({ account, chainId });
      const items = Object.values(addressBook.data);

      await target.deleteAddressBookItem({
        addressBook,
        id: addressBook.data[1].id,
      });

      const afterDeletion = await target.getAddressBook({ account, chainId });
      expect(afterDeletion).toMatchObject({
        data: [items[0], items[2]],
        accountId: account.id,
        chainId,
      });

      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();
      const newItem = await target.createAddressBookItem({
        account,
        chainId,
        createAddressBookItemDto,
      });

      expect(newItem).toMatchObject({
        id: 4,
        address: createAddressBookItemDto.address,
        name: createAddressBookItemDto.name,
      });
    });

    it('should throw an error if the address book item does not exist', async () => {
      const account = await createTestAccount();
      const chainId = faker.string.numeric();
      const createAddressBookItemDtoArray = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      for (const createAddressBookItemDto of createAddressBookItemDtoArray) {
        await target.createAddressBookItem({
          account,
          chainId,
          createAddressBookItemDto,
        });
      }
      const addressBook = await target.getAddressBook({ account, chainId });
      const nonExistentId = addressBook.data.reduce((sum, i) => sum + i.id, 1);

      await expect(
        target.deleteAddressBookItem({
          addressBook,
          id: nonExistentId,
        }),
      ).rejects.toThrow('Address Book Item not found');
    });
  });
});
