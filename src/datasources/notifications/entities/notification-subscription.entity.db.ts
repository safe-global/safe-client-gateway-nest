import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity.db';
import {
  NotificationSubscriptionNotificationType,
  NotificationSubscriptionNotificationTypeSchema,
} from '@/datasources/notifications/entities/notification-subscription-notification-type.entity.db';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import {
  Column,
  Entity,
  Unique,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { getAddress } from 'viem';
import { z } from 'zod';

export const NotificationSubscriptionSchema = RowSchema.extend({
  chain_id: NumericStringSchema,
  safe_address: AddressSchema,
  signer_address: AddressSchema.nullable(),
  notification_subscription_notification_type: z.array(
    NotificationSubscriptionNotificationTypeSchema,
  ),
});

@Entity('notification_subscriptions')
@Unique([
  'chain_id',
  'safe_address',
  'push_notification_device',
  'signer_address',
])
export class NotificationSubscription
  implements z.infer<typeof NotificationSubscriptionSchema>
{
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => NotificationDevice, (device) => device.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'push_notification_device_id' })
  push_notification_device!: NotificationDevice;

  @Column({
    type: 'varchar',
    length: 255,
  })
  chain_id!: string;

  @Column({
    type: 'varchar',
    length: 42,
    transformer: {
      from(value: string): `0x${string}` {
        return getAddress(value);
      },
      to(value: string): `0x${string}` {
        return getAddress(value);
      },
    },
  })
  safe_address!: `0x${string}`;

  @Column({
    type: 'varchar',
    nullable: true,
    length: 42,
    transformer: {
      from(value?: string): string | null {
        return value ? getAddress(value) : null;
      },
      to(value?: string): string | null {
        return value ? getAddress(value) : null;
      },
    },
  })
  signer_address!: `0x${string}` | null;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;

  @OneToMany(
    () => NotificationSubscriptionNotificationType,
    (notificationSubscriptionNotificationType) =>
      notificationSubscriptionNotificationType.id,
  )
  notification_subscription_notification_type!: Array<NotificationSubscriptionNotificationType>;
}
