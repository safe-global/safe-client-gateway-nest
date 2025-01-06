import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  FirebaseOauth2Token,
  FirebaseOauth2TokenSchema,
} from '@/datasources/push-notifications-api/entities/firebase-oauth2-token.entity';

@Injectable()
export class FirebaseCloudMessagingApiService implements IPushNotificationsApi {
  private static readonly OAuth2TokenUrl =
    'https://oauth2.googleapis.com/token';
  private static readonly OAuth2TokenTtlBufferInSeconds = 5;
  private static readonly Scope =
    'https://www.googleapis.com/auth/firebase.messaging';

  private readonly baseUrl: string;
  private readonly project: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUrl = this.configurationService.getOrThrow<string>(
      'pushNotifications.baseUri',
    );
    this.project = this.configurationService.getOrThrow<string>(
      'pushNotifications.project',
    );
    // Service account credentials are used for OAuth2 assertion
    this.clientEmail = this.configurationService.getOrThrow<string>(
      'pushNotifications.serviceAccount.clientEmail',
    );
    this.privateKey = this.configurationService.getOrThrow<string>(
      'pushNotifications.serviceAccount.privateKey',
    );
  }

  /**
   * Enqueues a notification to be sent to a device with given FCM token.
   *
   * @param fcmToken - device's FCM token
   * @param notification - notification payload
   */
  async enqueueNotification(
    fcmToken: string,
    notification: FirebaseNotification,
  ): Promise<void> {
    const url = `${this.baseUrl}/${this.project}/messages:send`;
    try {
      const accessToken = await this.getOauth2Token();
      await this.networkService.post({
        url,
        data: {
          message: {
            token: fcmToken,
            ...notification,
          },
        },
        networkRequest: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    } catch (error) {
      /**
       * TODO: Error handling based on `error.details[i].reason`, e.g.
       * - expired OAuth2 token
       * - stale FCM token
       * - don't expose the error to clients, logging on domain level
       */
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Retrieves and caches OAuth2 token for Firebase Cloud Messaging API.
   *
   * @returns - OAuth2 token
   */
  // TODO: Use CacheFirstDataSource
  private async getOauth2Token(): Promise<string> {
    const cacheDir = CacheRouter.getFirebaseOAuth2TokenCacheDir();
    const cachedToken = await this.cacheService.hGet(cacheDir);

    if (cachedToken) {
      return cachedToken;
    }

    const data = await this.networkService
      .post<FirebaseOauth2Token>({
        url: FirebaseCloudMessagingApiService.OAuth2TokenUrl,
        data: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: this.getAssertion(),
        },
      })
      .then((response) => FirebaseOauth2TokenSchema.parse(response.data));

    // Token cached according to issuance
    await this.cacheService.hSet(
      cacheDir,
      data.access_token,
      // Buffer ensures token is not cached beyond expiration if caching took time
      data.expires_in -
        FirebaseCloudMessagingApiService.OAuth2TokenTtlBufferInSeconds,
    );

    return data.access_token;
  }

  /**
   * Generates a signed JWT assertion for OAuth2 token request.
   *
   * @returns - signed JWT assertion
   */
  private getAssertion(): string {
    const now = new Date();

    const payload = {
      iss: this.clientEmail,
      scope: FirebaseCloudMessagingApiService.Scope,
      aud: FirebaseCloudMessagingApiService.OAuth2TokenUrl,
      iat: now,
      // Maximum expiration time is 1 hour
      exp: new Date(now.getTime() + 60 * 60 * 1_000),
    };

    return this.jwtService.sign(payload, {
      secretOrPrivateKey: this.privateKey,
      algorithm: 'RS256',
    });
  }
}
