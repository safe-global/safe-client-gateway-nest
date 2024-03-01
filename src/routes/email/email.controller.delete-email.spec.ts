import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { getAddress } from 'viem';
import { EmailControllerModule } from '@/routes/email/email.controller.module';
import { AccountDoesNotExistError } from '@/datasources/account/errors/account-does-not-exist.error';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { INestApplication } from '@nestjs/common';

describe('Email controller delete email tests', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;
  let emailApi: jest.MockedObjectDeep<IEmailApi>;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration), EmailControllerModule],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(EmailApiModule)
      .useModule(TestEmailApiModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    accountDataSource = moduleFixture.get(IAccountDataSource);
    emailApi = moduleFixture.get(IEmailApi);
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes email successfully', async () => {
    const chain = chainBuilder().build();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    const safeAddress = faker.finance.ethereumAddress();
    const account = accountBuilder()
      .with('signer', signerAddress)
      .with('safeAddress', safeAddress)
      .with('chainId', chain.chainId)
      .build();
    const message = `email-delete-${chain.chainId}-${safeAddress}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    accountDataSource.getAccount.mockResolvedValue(account);
    accountDataSource.deleteAccount.mockImplementation(() => Promise.resolve());
    emailApi.deleteEmailAddress.mockResolvedValue();

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/safes/${safeAddress}/emails`)
      .send({
        account: signer.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(204)
      .expect({});

    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(1);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("returns 404 if trying to deleting an email that doesn't exist", async () => {
    const chain = chainBuilder().build();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [signerAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-delete-${chain.chainId}-${safe.address}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockRejectedValueOnce(
      new AccountDoesNotExistError(chain.chainId, safe.address, signerAddress),
    );

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        account: signer.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(404)
      .expect({
        statusCode: 404,
        message: `No email address was found for the provided signer ${signerAddress}.`,
      });

    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(0);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });

  it('returns 403 if message was signed with a timestamp older than 5 minutes', async () => {
    const chain = chainBuilder().build();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-delete-${chain.chainId}-${safe.address}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    jest.advanceTimersByTime(5 * 60 * 1000);

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        account: account.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on wrong message signature', async () => {
    const chain = chainBuilder().build();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [accountAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `some-action-${chain.chainId}-${safe.address}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        account: account.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 500 if email api throws', async () => {
    const chain = chainBuilder().build();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const signerAddress = signer.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      .with('owners', [signerAddress])
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const account = accountBuilder()
      .with('signer', signerAddress)
      .with('safeAddress', safe.address)
      .with('chainId', chain.chainId)
      .build();
    const message = `email-delete-${chain.chainId}-${safe.address}-${signerAddress}-${timestamp}`;
    const signature = await signer.signMessage({ message });
    networkService.get.mockImplementation((url) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    accountDataSource.getAccount.mockResolvedValueOnce(account);
    emailApi.deleteEmailAddress.mockRejectedValue(new Error('Some error'));

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        account: signer.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(500)
      .expect({ code: 500, message: 'Internal server error' });

    expect(emailApi.deleteEmailAddress).toHaveBeenCalledTimes(1);
    expect(accountDataSource.deleteAccount).toHaveBeenCalledTimes(0);
  });
});
