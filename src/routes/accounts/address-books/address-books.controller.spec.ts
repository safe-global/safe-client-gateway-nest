import { TestAppProvider } from '@/__tests__/test-app.provider';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountsDataSourceModule } from '@/datasources/accounts/__tests__/test.accounts.datasource.module';
import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { TestAddressBooksDataSourceModule } from '@/datasources/accounts/address-books/__tests__/test.address-books.datasource.module';
import { AddressBooksDatasourceModule } from '@/datasources/accounts/address-books/address-books.datasource.module';
import { TestCounterfactualSafesDataSourceModule } from '@/datasources/accounts/counterfactual-safes/__tests__/test.counterfactual-safes.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import type { IAccountsRepository } from '@/domain/accounts/accounts.repository.interface';
import {
  addressBookBuilder,
  addressBookItemBuilder,
} from '@/domain/accounts/address-books/entities/__tests__/address-book.builder';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';
import { IAddressBooksDatasource } from '@/domain/interfaces/address-books.datasource.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { AddressBooksController } from '@/routes/accounts/address-books/address-books.controller';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { faker } from '@faker-js/faker/.';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import { getAddress } from 'viem';
import request from 'supertest';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { accountBuilder } from '@/domain/accounts/entities/__tests__/account.builder';
import { accountDataTypeBuilder } from '@/domain/accounts/entities/__tests__/account-data-type.builder';
import { AccountDataTypeNames } from '@/domain/accounts/entities/account-data-type.entity';
import { accountDataSettingBuilder } from '@/domain/accounts/entities/__tests__/account-data-setting.builder';
import { createAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/create-address-book-item.dto.builder';
import { AddressBookNotFoundError } from '@/domain/accounts/address-books/errors/address-book-not-found.error';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { updateAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/update-address-book-item.dto.builder';

describe('AddressBooksController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let accountsRepository: jest.MockedObjectDeep<IAccountsRepository>;
  let addressBooksDatasource: jest.MockedObjectDeep<IAddressBooksDatasource>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        accounts: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(AccountsDatasourceModule)
      .useModule(TestAccountsDataSourceModule)
      .overrideModule(AddressBooksDatasourceModule)
      .useModule(TestAddressBooksDataSourceModule)
      .overrideModule(CounterfactualSafesDatasourceModule)
      .useModule(TestCounterfactualSafesDataSourceModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .compile();
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    accountsRepository = moduleFixture.get(IAccountsDatasource);
    addressBooksDatasource = moduleFixture.get(IAddressBooksDatasource);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('AuthGuard', () => {
    it('checks that the AuthGuard is applied to the proper controller endpoints', () => {
      const protectedEndpoints = [
        AddressBooksController.prototype.getAddressBook,
        AddressBooksController.prototype.createAddressBookItem,
        AddressBooksController.prototype.deleteAddressBook,
        AddressBooksController.prototype.deleteAddressBookItem,
      ];
      protectedEndpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
    });
  });

  describe('GET /accounts/:address/address-books/:chainId', () => {
    it('should return an AddressBook', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      const addressBook = addressBookBuilder().build();
      addressBooksDatasource.getAddressBook.mockResolvedValue(addressBook);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({
          id: addressBook.id.toString(),
          accountId: addressBook.accountId.toString(),
          chainId: addressBook.chainId,
          data: addressBook.data.map((item) => ({
            id: item.id.toString(),
            name: item.name,
            address: item.address,
          })),
        });
    });

    it('should return a 404 if the AddressBook does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      addressBooksDatasource.getAddressBook.mockImplementation(() => {
        throw new AddressBookNotFoundError();
      });

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress())) // Different address
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);
    });

    it('should fail if the account does not have the AddressBooks data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false) // AddressBooks setting is not enabled
          .build(),
      ]);

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountsRepository.getAccount.mockRejectedValue(
        new Error('Database error'),
      );

      await request(app.getHttpServer())
        .get(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });
  });

  describe('POST /accounts/:address/address-books/:chainId', () => {
    it('should create an AddressBookItem', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      const addressBook = addressBookBuilder().build();
      addressBooksDatasource.getAddressBook.mockResolvedValue(addressBook);
      const addressBookItem = addressBookItemBuilder().build();
      addressBooksDatasource.createAddressBookItem.mockResolvedValue(
        addressBookItem,
      );
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();

      await request(app.getHttpServer())
        .post(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAddressBookItemDto)
        .expect(201)
        .expect({
          id: addressBookItem.id.toString(),
          name: addressBookItem.name,
          address: addressBookItem.address,
        });
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress())) // Different address
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();

      await request(app.getHttpServer())
        .post(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAddressBookItemDto)
        .expect(401);
    });

    it('should fail if the account does not have the AddressBooks data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false) // AddressBooks setting is not enabled
          .build(),
      ]);

      await request(app.getHttpServer())
        .post(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAddressBookItemDto)
        .expect(410);
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const createAddressBookItemDto =
        createAddressBookItemDtoBuilder().build();
      accountsRepository.getAccount.mockRejectedValue(
        new Error('Database error'),
      );

      await request(app.getHttpServer())
        .post(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(createAddressBookItemDto)
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });
  });

  describe('PUT /accounts/:address/address-books/:chainId/:addressBookItemId', () => {
    it('should update an AddressBookItem', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      const addressBook = addressBookBuilder().build();
      addressBooksDatasource.getAddressBook.mockResolvedValue(addressBook);
      const addressBookItem = addressBookItemBuilder().build();
      addressBooksDatasource.updateAddressBookItem.mockResolvedValue(
        addressBookItem,
      );
      const updateAddressBookItemDto =
        updateAddressBookItemDtoBuilder().build();

      await request(app.getHttpServer())
        .put(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(updateAddressBookItemDto)
        .expect(200)
        .expect({
          id: addressBookItem.id.toString(),
          name: addressBookItem.name,
          address: addressBookItem.address,
        });
    });

    it('should return a 404 if the AddressBook does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      addressBooksDatasource.getAddressBook.mockImplementation(() => {
        throw new AddressBookNotFoundError();
      });
      const updateAddressBookItemDto =
        updateAddressBookItemDtoBuilder().build();

      await request(app.getHttpServer())
        .put(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(updateAddressBookItemDto)
        .expect(404);
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress())) // Different address
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const updateAddressBookItemDto =
        updateAddressBookItemDtoBuilder().build();

      await request(app.getHttpServer())
        .put(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(updateAddressBookItemDto)
        .expect(401);
    });

    it('should fail if the account does not have the AddressBooks data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      const updateAddressBookItemDto =
        updateAddressBookItemDtoBuilder().build();
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false) // AddressBooks setting is not enabled
          .build(),
      ]);

      await request(app.getHttpServer())
        .put(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(updateAddressBookItemDto)
        .expect(410);
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const updateAddressBookItemDto =
        updateAddressBookItemDtoBuilder().build();
      accountsRepository.getAccount.mockRejectedValue(
        new Error('Database error'),
      );

      await request(app.getHttpServer())
        .put(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(updateAddressBookItemDto)
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });
  });

  describe('DELETE /accounts/:address/address-books/:chainId', () => {
    it('should delete an AddressBook', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      const addressBook = addressBookBuilder().build();
      addressBooksDatasource.getAddressBook.mockResolvedValue(addressBook);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(addressBooksDatasource.deleteAddressBook).toHaveBeenCalledWith(
        addressBook,
      );
    });

    it('should return a 404 if the AddressBook does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      addressBooksDatasource.getAddressBook.mockImplementation(() => {
        throw new AddressBookNotFoundError();
      });

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);

      expect(addressBooksDatasource.deleteAddressBook).not.toHaveBeenCalled();
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress())) // Different address
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(addressBooksDatasource.deleteAddressBook).not.toHaveBeenCalled();
    });

    it('should fail if the account does not have the AddressBooks data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false) // AddressBooks setting is not enabled
          .build(),
      ]);

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);

      expect(addressBooksDatasource.deleteAddressBook).not.toHaveBeenCalled();
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountsRepository.getAccount.mockRejectedValue(
        new Error('Database error'),
      );

      await request(app.getHttpServer())
        .delete(`/v1/accounts/${address}/address-books/${chainId}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(addressBooksDatasource.deleteAddressBook).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /accounts/:address/address-books/:chainId/:addressBookItemId', () => {
    it('should delete an AddressBookItem', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      const addressBook = addressBookBuilder().build();
      addressBooksDatasource.getAddressBook.mockResolvedValue(addressBook);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(addressBooksDatasource.deleteAddressBookItem).toHaveBeenCalledWith(
        {
          addressBook,
          id: addressBookItemId,
        },
      );
    });

    it('should return a 404 if the AddressBook does not exist', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', true)
          .build(),
      ]);
      addressBooksDatasource.getAddressBook.mockImplementation(() => {
        throw new AddressBookNotFoundError();
      });

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);

      expect(
        addressBooksDatasource.deleteAddressBookItem,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the authPayload does not match the URL address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', getAddress(faker.finance.ethereumAddress())) // Different address
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(
        addressBooksDatasource.deleteAddressBookItem,
      ).not.toHaveBeenCalled();
    });

    it('should fail if the account does not have the AddressBooks data setting enabled', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const account = accountBuilder().build();
      const accountDataTypes = [
        accountDataTypeBuilder()
          .with('name', AccountDataTypeNames.AddressBook)
          .with('is_active', true)
          .build(),
      ];
      accountsRepository.getAccount.mockResolvedValue(account);
      accountsRepository.getDataTypes.mockResolvedValue(accountDataTypes);
      accountsRepository.getAccountDataSettings.mockResolvedValue([
        accountDataSettingBuilder()
          .with('account_id', account.id)
          .with('account_data_type_id', accountDataTypes[0].id)
          .with('enabled', false) // AddressBooks setting is not enabled
          .build(),
      ]);

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(410);

      expect(
        addressBooksDatasource.deleteAddressBookItem,
      ).not.toHaveBeenCalled();
    });

    it('should not propagate a database error', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const chainId = faker.string.numeric();
      const addressBookItemId = faker.number.int({
        min: 1,
        max: DB_MAX_SAFE_INTEGER,
      });
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chainId)
        .with('signer_address', address)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      accountsRepository.getAccount.mockRejectedValue(
        new Error('Database error'),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/accounts/${address}/address-books/${chainId}/${addressBookItemId}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });

      expect(
        addressBooksDatasource.deleteAddressBookItem,
      ).not.toHaveBeenCalled();
    });
  });
});
