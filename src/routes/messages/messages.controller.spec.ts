import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { messageConfirmationBuilder } from '@/domain/messages/entities/__tests__/message-confirmation.builder';
import {
  messageBuilder,
  toJson as messageToJson,
} from '@/domain/messages/entities/__tests__/message.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { createMessageDtoBuilder } from '@/routes/messages/entities/__tests__/create-message.dto.builder';
import { updateMessageSignatureDtoBuilder } from '@/routes/messages/entities/__tests__/update-message-signature.dto.builder';
import { MessageStatus } from '@/routes/messages/entities/message.entity';
import { SafeApp } from '@/routes/safe-apps/entities/safe-app.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';

describe('Messages controller', () => {
  let app: INestApplication;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(configuration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET messages by hash', () => {
    it('Get a confirmed message with no safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps: Array<SafeApp> = [];
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const message = messageBuilder()
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ max: messageConfirmations.length }),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({
              data: messageToJson(message),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.Confirmed,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: message.preparedSignature,
        });
    });

    it('Get a confirmed message with a safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps = faker.helpers.multiple(() => safeAppBuilder().build(), {
        count: { min: 2, max: 5 },
      });
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const message = messageBuilder()
        .with('safeAppId', safeApps[1].id)
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ max: messageConfirmations.length }),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({
              data: messageToJson(message),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.Confirmed,
          logoUri: safeApps[1].iconUrl,
          name: safeApps[1].name,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: message.preparedSignature,
        });
    });

    it('Get an unconfirmed message with no safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps: Array<SafeApp> = [];
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const message = messageBuilder()
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ min: messageConfirmations.length + 1 }),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({
              data: messageToJson(message),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });

    it('Get an unconfirmed message with a safe app associated', async () => {
      const chain = chainBuilder().build();
      const safeApps = faker.helpers.multiple(() => safeAppBuilder().build(), {
        count: { min: 3, max: 5 },
      });
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const message = messageBuilder()
        .with('safeAppId', safeApps[2].id)
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ min: messageConfirmations.length + 1 }),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({
              data: messageToJson(message),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: safeApps, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: safeApps[2].iconUrl,
          name: safeApps[2].name,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });

    it('should return null name and logo if the Safe App is not found', async () => {
      const chain = chainBuilder().build();
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const message = messageBuilder()
        .with('safeAppId', faker.number.int())
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ min: messageConfirmations.length + 1 }),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({
              data: messageToJson(message),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: [], status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });

    it('should return null name and logo if no safeAppId in the message', async () => {
      const chain = chainBuilder().build();
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const message = messageBuilder()
        .with('safeAppId', null)
        .with('confirmations', messageConfirmations)
        .build();
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ min: messageConfirmations.length + 1 }),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/messages/${message.messageHash}`:
            return Promise.resolve({
              data: messageToJson(message),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${message.safe}`:
            return Promise.resolve({ data: safe, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/messages/${message.messageHash}`)
        .expect(200)
        .expect({
          messageHash: message.messageHash,
          status: MessageStatus.NeedsConfirmation,
          logoUri: null,
          name: null,
          message: message.message,
          creationTimestamp: message.created.getTime(),
          modifiedTimestamp: message.modified.getTime(),
          confirmationsSubmitted: messageConfirmations.length,
          confirmationsRequired: safe.threshold,
          proposedBy: {
            value: message.proposedBy,
            name: null,
            logoUri: null,
          },
          confirmations: messageConfirmations.map((confirmation) => ({
            owner: {
              value: confirmation.owner,
              name: null,
              logoUri: null,
            },
            signature: confirmation.signature,
          })),
          preparedSignature: null,
        });
    });
  });

  describe('Get messages by Safe address', () => {
    it('Failure: data page validation fails', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const page = pageBuilder().with('results', []).build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`:
            return Promise.resolve({
              data: { ...page, previous: faker.number.int() },
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .expect(500)
        .expect({ message: 'Validation failed', code: 42, arguments: [] });
    });

    it('should get a message with a date label', async () => {
      const chain = chainBuilder().build();
      const messageConfirmations = faker.helpers.multiple(
        () => messageConfirmationBuilder().build(),
        { count: { min: 2, max: 5 } },
      );
      const safe = safeBuilder()
        .with(
          'threshold',
          faker.number.int({ min: messageConfirmations.length + 1 }),
        )
        .build();
      const message = messageBuilder()
        .with('safeAppId', null)
        .with('created', faker.date.recent())
        .with('confirmations', messageConfirmations)
        .build();
      const page = pageBuilder()
        .with('previous', null)
        .with('next', null)
        .with('count', 1)
        .with('results', [messageToJson(message)])
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`:
            return Promise.resolve({ data: page, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual(
            pageBuilder()
              .with('next', null)
              .with('previous', null)
              .with('count', 1)
              .with('results', [
                {
                  type: 'DATE_LABEL',
                  timestamp: new Date(
                    Date.UTC(
                      message.created.getUTCFullYear(),
                      message.created.getUTCMonth(),
                      message.created.getUTCDate(),
                    ),
                  ).getTime(),
                },
                {
                  type: 'MESSAGE',
                  messageHash: message.messageHash,
                  status: MessageStatus.NeedsConfirmation,
                  logoUri: null,
                  name: null,
                  message: message.message,
                  creationTimestamp: message.created.getTime(),
                  modifiedTimestamp: message.modified.getTime(),
                  confirmationsSubmitted: messageConfirmations.length,
                  confirmationsRequired: safe.threshold,
                  proposedBy: {
                    value: message.proposedBy,
                    name: null,
                    logoUri: null,
                  },
                  confirmations: messageConfirmations.map((confirmation) => ({
                    owner: {
                      value: confirmation.owner,
                      name: null,
                      logoUri: null,
                    },
                    signature: confirmation.signature,
                  })),
                  preparedSignature: null,
                },
              ])
              .build(),
          );
        });
    });

    it('should group messages by date', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const messageCreationDate = faker.date.recent();
      const messages = faker.helpers.multiple(
        () =>
          messageBuilder()
            .with('safeAppId', null)
            .with('created', messageCreationDate)
            .build(),
        { count: { min: 1, max: 4 } },
      );
      const page = pageBuilder()
        .with('previous', null)
        .with('next', null)
        .with('count', messages.length)
        .with(
          'results',
          messages.map((m) => messageToJson(m)),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`:
            return Promise.resolve({ data: page, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual(
            pageBuilder()
              .with('next', null)
              .with('previous', null)
              .with('count', messages.length)
              .with('results', [
                {
                  type: 'DATE_LABEL',
                  timestamp: new Date(
                    Date.UTC(
                      messageCreationDate.getUTCFullYear(),
                      messageCreationDate.getUTCMonth(),
                      messageCreationDate.getUTCDate(),
                    ),
                  ).getTime(),
                },
                ...messages.map((m) =>
                  expect.objectContaining({
                    type: 'MESSAGE',
                    messageHash: m.messageHash,
                  }),
                ),
              ])
              .build(),
          );
        });
    });

    it('should group messages by date (2)', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const messages = [
        messageBuilder()
          .with('safeAppId', null)
          .with(
            'created',
            faker.date.between({
              from: new Date(Date.UTC(2025, 0, 1, 16)).toISOString(),
              to: new Date(Date.UTC(2025, 0, 1, 17)).toISOString(),
            }),
          )
          .build(),
        messageBuilder()
          .with('safeAppId', null)
          .with(
            'created',
            faker.date.between({
              from: new Date(Date.UTC(2025, 0, 2)).toISOString(),
              to: new Date(Date.UTC(2025, 0, 3) - 1).toISOString(),
            }),
          )
          .build(),
        messageBuilder()
          .with('safeAppId', null)
          .with(
            'created',
            faker.date.between({
              from: new Date(Date.UTC(2025, 0, 1, 10)).toISOString(),
              to: new Date(Date.UTC(2025, 0, 1, 11)).toISOString(),
            }),
          )
          .build(),
        messageBuilder()
          .with('safeAppId', null)
          .with(
            'created',
            faker.date.between({
              from: new Date(Date.UTC(2025, 0, 3)).toISOString(),
              to: new Date(Date.UTC(2025, 0, 4) - 1).toISOString(),
            }),
          )
          .build(),
      ];
      const page = pageBuilder()
        .with('previous', null)
        .with('next', null)
        .with('count', messages.length)
        .with(
          'results',
          messages.map((m) => messageToJson(m)),
        )
        .build();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            return Promise.resolve({ data: safe, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`:
            return Promise.resolve({ data: page, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual(
            pageBuilder()
              .with('next', null)
              .with('previous', null)
              .with('count', messages.length)
              .with('results', [
                {
                  type: 'DATE_LABEL',
                  timestamp: Date.UTC(2025, 0, 3),
                },
                expect.objectContaining({
                  type: 'MESSAGE',
                  messageHash: messages[3].messageHash,
                }),
                {
                  type: 'DATE_LABEL',
                  timestamp: Date.UTC(2025, 0, 2),
                },
                expect.objectContaining({
                  type: 'MESSAGE',
                  messageHash: messages[1].messageHash,
                }),
                {
                  type: 'DATE_LABEL',
                  timestamp: Date.UTC(2025, 0, 1),
                },
                expect.objectContaining({
                  type: 'MESSAGE',
                  messageHash: messages[0].messageHash,
                }),
                expect.objectContaining({
                  type: 'MESSAGE',
                  messageHash: messages[2].messageHash,
                }),
              ])
              .build(),
          );
        });
    });
  });

  describe('Create messages', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const message = messageBuilder().build();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`
          ? Promise.resolve({ data: messageToJson(message), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .send(createMessageDtoBuilder().build())
        .expect(200)
        .expect(JSON.stringify(messageToJson(message)));
    });

    it('should return an error from the Transaction Service', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/messages/`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        { status: 400 } as Response,
        { message: errorMessage },
      );
      networkService.post.mockImplementation((url) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .send(createMessageDtoBuilder().build())
        .expect(400)
        .expect({
          message: errorMessage,
          code: 400,
        });
    });

    it('should get a validation error', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/messages`)
        .send(
          createMessageDtoBuilder().with('message', faker.number.int()).build(),
        )
        .expect(400)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });

  describe('Update message signatures', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const message = messageBuilder()
        .with('safeAppId', null)
        .with('created', faker.date.recent())
        .build();
      const expectedResponse = {
        data: { signature: faker.string.hexadecimal() },
        status: 200,
      };
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/messages/${message.messageHash}/signatures/`
          ? Promise.resolve(expectedResponse)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/messages/${message.messageHash}/signatures`,
        )
        .send(updateMessageSignatureDtoBuilder().build())
        .expect(200)
        .expect(expectedResponse.data);
    });

    it('should return an error from the provider', async () => {
      const chain = chainBuilder().build();
      const message = messageBuilder()
        .with('safeAppId', null)
        .with('created', faker.date.recent())
        .build();
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/messages/${message.messageHash}/signatures/`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: errorMessage },
      );
      networkService.post.mockImplementation((url) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/messages/${message.messageHash}/signatures`,
        )
        .send(updateMessageSignatureDtoBuilder().build())
        .expect(400)
        .expect({
          message: errorMessage,
          code: 400,
        });
    });

    it('should get a validation error', async () => {
      const chain = chainBuilder().build();
      const message = messageBuilder()
        .with('safeAppId', null)
        .with('created', faker.date.recent())
        .build();

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/messages/${message.messageHash}/signatures`,
        )
        .send({})
        .expect(400)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });
});
