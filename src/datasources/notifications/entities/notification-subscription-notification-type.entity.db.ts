import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { z } from 'zod';

export const NotificationSubscriptionNotificationTypeSchema = z.object({
  id: z.number(),
});

@Entity('notification_subscription_notification_types')
@Unique(['notification_subscription', 'notification_type'])
export class NotificationSubscriptionNotificationType
  implements z.infer<typeof NotificationSubscriptionNotificationTypeSchema>
{
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => NotificationSubscription,
    (subscription) => subscription.id,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'notification_subscription_id',
  })
  notification_subscription!: NotificationSubscription;

  @ManyToOne(
    () => NotificationType,
    (notificationType) =>
      notificationType.notification_subscription_notification_type,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'notification_type_id' })
  notification_type!: NotificationType;
}
