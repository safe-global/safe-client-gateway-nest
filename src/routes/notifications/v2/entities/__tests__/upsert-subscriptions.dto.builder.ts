import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { getAddress } from 'viem';
import type { UpsertSubscriptionsDto } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import type { UUID } from 'crypto';

export function upsertSubscriptionsDtoBuilder(): IBuilder<UpsertSubscriptionsDto> {
  return new Builder<UpsertSubscriptionsDto>()
    .with('cloudMessagingToken', faker.string.alphanumeric({ length: 10 }))
    .with('deviceType', faker.helpers.arrayElement(Object.values(DeviceType)))
    .with('deviceUuid', faker.string.uuid() as UUID)
    .with(
      'safes',
      Array.from(
        {
          length: faker.number.int({ min: 1, max: 5 }),
        },
        () => {
          return {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          };
        },
      ),
    );
}
