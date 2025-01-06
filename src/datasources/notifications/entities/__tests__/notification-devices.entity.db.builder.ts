import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity.db';
import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { faker } from '@faker-js/faker/.';
import type { UUID } from 'crypto';

export function notificationDeviceBuilder(): IBuilder<NotificationDevice> {
  return new Builder<NotificationDevice>()
    .with('id', faker.number.int())
    .with('device_uuid', faker.string.uuid() as UUID)
    .with('device_type', faker.helpers.enumValue(DeviceType))
    .with(
      'cloud_messaging_token',
      faker.string.alphanumeric({ length: { min: 10, max: 255 } }),
    )
    .with('created_at', new Date())
    .with('updated_at', new Date());
}
