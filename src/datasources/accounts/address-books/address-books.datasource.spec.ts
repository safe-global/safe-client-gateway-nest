import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AddressBooksDatasource } from '@/datasources/accounts/address-books/address-books.datasource';
import { AddressBookDbMapper } from '@/datasources/accounts/address-books/entities/address-book.db.mapper';
import type { EncryptionApiManager } from '@/datasources/accounts/encryption/encryption-api.manager';
import { LocalEncryptionApiService } from '@/datasources/accounts/encryption/local-encryption-api.service';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { createAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/create-address-book.builder';
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

  describe('createAddressBookItem', () => {
    it('should create an address book if it does not exist when adding a new item', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<Account[]>`
        INSERT INTO accounts (address, name, name_hash)
        VALUES (
          ${createAccountDto.address},
          ${createAccountDto.name},
          ${faker.string.alphanumeric(32)}
        ) RETURNING *`;
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();

      const addressBookItem = await target.createAddressBookItem({
        account,
        createAddressBookItemDto,
      });

      expect(addressBookItem).toMatchObject({
        id: expect.any(Number),
        address: createAddressBookItemDto.address,
        name: createAddressBookItemDto.name,
      });
      expect(await target.getOrCreateAddressBook(account)).toMatchObject({
        data: [createAddressBookItemDto],
        accountId: account.id,
      });
    });

    it('should create a several address book items', async () => {
      const createAccountDto = createAccountDtoBuilder().build();
      const [account] = await sql<Account[]>`
        INSERT INTO accounts (address, name, name_hash)
        VALUES (
          ${createAccountDto.address},
          ${createAccountDto.name},
          ${faker.string.alphanumeric(32)}
        ) RETURNING *`;
      const createAddressBookItemDtos = [
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
        createAddressBookItemDtoBuilder().build(),
      ];
      await target.createAddressBookItem({
        account,
        createAddressBookItemDto: createAddressBookItemDtos[0],
      });
      expect(await target.getOrCreateAddressBook(account)).toMatchObject({
        data: [createAddressBookItemDtos[0]],
        accountId: account.id,
      });
      await target.createAddressBookItem({
        account,
        createAddressBookItemDto: createAddressBookItemDtos[1],
      });
      expect(await target.getOrCreateAddressBook(account)).toMatchObject({
        data: [createAddressBookItemDtos[0], createAddressBookItemDtos[1]],
        accountId: account.id,
      });
      await target.createAddressBookItem({
        account,
        createAddressBookItemDto: createAddressBookItemDtos[2],
      });
      expect(await target.getOrCreateAddressBook(account)).toMatchObject({
        data: createAddressBookItemDtos,
        accountId: account.id,
      });
    });
  });
});
