import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import { faker } from '@faker-js/faker/.';
import { NotificationType as NotificationTypeEnum } from '@/domain/notifications/v2/entities/notification.entity';

export function notificationTypeBuilder(): IBuilder<NotificationType> {
  return new Builder<NotificationType>()
    .with('id', faker.number.int())
    .with('name', faker.helpers.enumValue(NotificationTypeEnum))
    .with('notification_subscription_notification_type', []);
}
