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
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { TestEmailApiModule } from '@/datasources/email-api/__tests__/test.email-api.module';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';
import { INestApplication } from '@nestjs/common';

describe('Email controller save email tests', () => {
  let app: INestApplication;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;
  let emailApi: jest.MockedObjectDeep<IEmailApi>;
  let accountDataSource: jest.MockedObjectDeep<IAccountDataSource>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let safeConfigUrl: string | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration), EmailControllerModule],
    })
      .overrideModule(EmailApiModule)
      .useModule(TestEmailApiModule)
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    emailApi = moduleFixture.get(IEmailApi);
    accountDataSource = moduleFixture.get(IAccountDataSource);
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

  it('stores email successfully', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
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
    const message = `email-register-${chain.chainId}-${safe.address}-${emailAddress}-${signerAddress}-${timestamp}`;
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
    accountDataSource.createAccount.mockResolvedValue();

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
        account: signer.address,
        timestamp: timestamp,
        signature: signature,
      })
      .expect(201)
      .expect({});

    expect(emailApi.createMessage).toHaveBeenCalledTimes(1);
    expect(emailApi.createMessage).toHaveBeenNthCalledWith(1, {
      subject: 'Verification code',
      substitutions: { verificationCode: expect.any(String) },
      template: configurationService.getOrThrow(
        'email.templates.verificationCode',
      ),
      to: [emailAddress],
    });
  });

  it('returns 403 is message was signed with a timestamp older than 5 minutes', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
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
    const message = `email-register-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    jest.advanceTimersByTime(5 * 60 * 1000);

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
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
    const emailAddress = faker.internet.email();
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
    const message = `some-action-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
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

  it('returns 403 if message not signed by owner', async () => {
    const chain = chainBuilder().build();
    const emailAddress = faker.internet.email();
    const timestamp = jest.now();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const accountAddress = account.address;
    // Signer is owner of safe
    const safe = safeBuilder()
      // Faker generates non-checksum addresses only
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const message = `email-register-${chain.chainId}-${safe.address}-${emailAddress}-${accountAddress}-${timestamp}`;
    const signature = await account.signMessage({ message });
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

    await request(app.getHttpServer())
      .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/emails`)
      .send({
        emailAddress: emailAddress,
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
});
