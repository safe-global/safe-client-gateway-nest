import {
  NotificationSubscriptionNotificationType,
  NotificationSubscriptionNotificationTypeSchema,
} from '@/datasources/notifications/entities/notification-subscription-notification-type.entity.db';
import { NotificationType as NotificationTypeEnum } from '@/domain/notifications/v2/entities/notification.entity';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { z } from 'zod';

export const NotificationTypeSchema = z.object({
  id: z.number(),
  name: z.nativeEnum(NotificationTypeEnum),
  notification_subscription_notification_type: z.array(
    NotificationSubscriptionNotificationTypeSchema,
  ),
});

@Entity('notification_types')
@Unique('name', ['name'])
export class NotificationType
  implements z.infer<typeof NotificationTypeSchema>
{
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: NotificationTypeEnum,
  })
  name!: NotificationTypeEnum;

  @OneToMany(
    () => NotificationSubscriptionNotificationType,
    (notificationSubscriptionType) =>
      notificationSubscriptionType.notification_type,
    { onDelete: 'CASCADE' },
  )
  notification_subscription_notification_type!: Array<NotificationSubscriptionNotificationType>;
}
