import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { firebaseNotificationBuilder } from '@/datasources/push-notifications-api/__tests__/firebase-notification.builder';
import { FirebaseCloudMessagingApiService } from '@/datasources/push-notifications-api/firebase-cloud-messaging-api.service';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockJwtService = jest.mocked({
  sign: jest.fn(),
} as jest.MockedObjectDeep<IJwtService>);

const mockHttpErrorFactory = jest.mocked({
  from: jest.fn(),
} as jest.MockedObjectDeep<HttpErrorFactory>);

describe('FirebaseCloudMessagingApiService', () => {
  let target: FirebaseCloudMessagingApiService;
  let fakeCacheService: FakeCacheService;

  let pushNotificationsBaseUri: string;
  let pushNotificationsProject: string;
  let pushNotificationsServiceAccountClientEmail: string;
  let pushNotificationsServiceAccountPrivateKey: string;

  beforeEach(() => {
    jest.resetAllMocks();

    pushNotificationsBaseUri = faker.internet.url({ appendSlash: false });
    pushNotificationsProject = faker.word.noun();
    pushNotificationsServiceAccountClientEmail = faker.internet.email();
    pushNotificationsServiceAccountPrivateKey = faker.string.alphanumeric();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'pushNotifications.baseUri',
      pushNotificationsBaseUri,
    );
    fakeConfigurationService.set(
      'pushNotifications.project',
      pushNotificationsProject,
    );
    fakeConfigurationService.set(
      'pushNotifications.serviceAccount.clientEmail',
      pushNotificationsServiceAccountClientEmail,
    );
    fakeConfigurationService.set(
      'pushNotifications.serviceAccount.privateKey',
      pushNotificationsServiceAccountPrivateKey,
    );

    fakeCacheService = new FakeCacheService();
    target = new FirebaseCloudMessagingApiService(
      mockNetworkService,
      fakeConfigurationService,
      fakeCacheService,
      mockJwtService,
      mockHttpErrorFactory,
    );
  });

  it('it should get an OAuth2 token if not cached, cache it and enqueue a notification', async () => {
    const oauth2AssertionJwt = faker.string.alphanumeric();
    const oauth2Token = faker.string.alphanumeric();
    const oauth2TokenExpiresIn = faker.number.int();
    const fcmToken = faker.string.alphanumeric();
    const notification = firebaseNotificationBuilder().build();
    mockJwtService.sign.mockReturnValue(oauth2AssertionJwt);
    mockNetworkService.post.mockResolvedValueOnce({
      status: 200,
      data: rawify({
        access_token: oauth2Token,
        expires_in: oauth2TokenExpiresIn,
        token_type: 'Bearer',
      }),
    });

    await expect(
      target.enqueueNotification(fcmToken, notification),
    ).resolves.toBeUndefined();

    expect(mockNetworkService.post).toHaveBeenCalledTimes(2);
    // Get OAuth2 token
    expect(mockNetworkService.post).toHaveBeenNthCalledWith(1, {
      url: 'https://oauth2.googleapis.com/token',
      data: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: oauth2AssertionJwt,
      },
    });
    // Send notification
    expect(mockNetworkService.post).toHaveBeenNthCalledWith(2, {
      url: `${pushNotificationsBaseUri}/${pushNotificationsProject}/messages:send`,
      data: {
        message: {
          token: fcmToken,
          ...notification,
        },
      },
      networkRequest: {
        headers: {
          Authorization: `Bearer ${oauth2Token}`,
        },
      },
    });
    // Cached OAuth2 token
    expect(fakeCacheService.keyCount()).toBe(1);
    await expect(
      fakeCacheService.hGet(new CacheDir('firebase_oauth2_token', '')),
    ).resolves.toBe(oauth2Token);
  });

  it('should use an OAuth2 token from cache if available', async () => {
    const oauth2Token = faker.string.alphanumeric();
    const oauth2TokenExpiresIn = faker.number.int();
    await fakeCacheService.hSet(
      new CacheDir('firebase_oauth2_token', ''),
      oauth2Token,
      oauth2TokenExpiresIn,
    );
    const fcmToken = faker.string.alphanumeric();
    const notification = firebaseNotificationBuilder().build();

    await expect(
      target.enqueueNotification(fcmToken, notification),
    ).resolves.toBeUndefined();

    expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    // Send notification
    expect(mockNetworkService.post).toHaveBeenNthCalledWith(1, {
      url: `${pushNotificationsBaseUri}/${pushNotificationsProject}/messages:send`,
      data: {
        message: {
          token: fcmToken,
          ...notification,
        },
      },
      networkRequest: {
        headers: {
          Authorization: `Bearer ${oauth2Token}`,
        },
      },
    });
  });
});
