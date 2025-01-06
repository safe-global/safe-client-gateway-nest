import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import type { UUID } from 'crypto';
import {
  Column,
  Entity,
  Unique,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { z } from 'zod';

export const NotificationDeviceSchema = RowSchema.extend({
  device_type: z.nativeEnum(DeviceType),
  device_uuid: UuidSchema,
  cloud_messaging_token: z.string(),
});

@Entity('push_notification_devices')
@Unique('device_uuid', ['device_uuid'])
export class NotificationDevice
  implements z.infer<typeof NotificationDeviceSchema>
{
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: DeviceType,
  })
  device_type!: DeviceType;

  @Column({ type: 'uuid' })
  device_uuid!: UUID;

  @Column({ type: 'varchar', length: 255 })
  cloud_messaging_token!: string;

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
    () => NotificationSubscription,
    (subscription) => subscription.id,
    {
      onDelete: 'CASCADE',
    },
  )
  notification_subscriptions!: Array<NotificationSubscription>;
}
