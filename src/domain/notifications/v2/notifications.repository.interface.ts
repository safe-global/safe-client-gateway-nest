import type { UpsertSubscriptionsDto } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import type { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import type { UUID } from 'crypto';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';

export const INotificationsRepositoryV2 = Symbol('INotificationsRepositoryV2');

export interface INotificationsRepositoryV2 {
  enqueueNotification(args: {
    token: string;
    deviceUuid: UUID;
    notification: FirebaseNotification;
  }): Promise<void>;

  upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }>;

  getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>>;

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  >;

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: UUID): Promise<void>;
}
