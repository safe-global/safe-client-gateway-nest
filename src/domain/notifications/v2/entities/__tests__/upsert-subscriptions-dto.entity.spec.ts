import type { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { upsertSubscriptionsDtoBuilder } from '@/routes/notifications/v2/entities/__tests__/upsert-subscriptions.dto.builder';
import { UpsertSubscriptionsDtoSchema } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { faker } from '@faker-js/faker';
import type { UUID } from 'crypto';
import { getAddress } from 'viem';

describe('UpsertSubscriptionsDtoSchema', () => {
  it('should validate a valid UpsertSubscriptionsDto', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(result.success).toBe(true);
  });

  it.each([
    ['cloudMessagingToken' as const, 'string'],
    ['safes' as const, 'array'],
    ['deviceType' as const, "'ANDROID' | 'IOS' | 'WEB'"],
  ])('should require %s', (key, expected) => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
    delete upsertSubscriptionsDto[key];

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected,
        message: 'Required',
        path: Array.isArray(result.error!.issues[0].path) ? [key] : key,
        received: 'undefined',
      },
    ]);
  });

  it('should not allow non-deviceType values for deviceType', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('deviceType', 'not-a-device-type' as DeviceType)
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_enum_value',
        message:
          "Invalid enum value. Expected 'ANDROID' | 'IOS' | 'WEB', received 'not-a-device-type'",
        options: ['ANDROID', 'IOS', 'WEB'],
        path: ['deviceType'],
        received: 'not-a-device-type',
      },
    ]);
  });

  it('should not allow non-UUID values for deviceUuid', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('deviceUuid', 'not-a-uuid' as UUID)
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_string',
        message: 'Invalid UUID',
        path: ['deviceUuid'],
        validation: 'uuid',
      },
    ]);
  });

  it('should allow a nullish deviceUuid, defaulting to null', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete upsertSubscriptionsDto.deviceUuid;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(result.success && result.data.deviceUuid).toBe(null);
  });

  it.each([
    ['chainId' as const, 'string'],
    ['address' as const, 'string'],
    ['notificationTypes' as const, 'array'],
  ])(`should require safes[number].%s`, (key, expected) => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
          notificationTypes: faker.helpers.arrayElements(
            Object.values(NotificationType),
          ),
        },
      ])
      .build();
    delete upsertSubscriptionsDto.safes[0][key];

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected,
        message: 'Required',
        path: ['safes', 0, key],
        received: 'undefined',
      },
    ]);
  });

  it('should checksum safes[number].address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: nonChecksummedAddress as `0x${string}`,
          notificationTypes: faker.helpers.arrayElements(
            Object.values(NotificationType),
          ),
        },
      ])
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(result.success && result.data.safes[0].address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should only allow NotificationType values for safes[number].notificationTypes', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
          notificationTypes: ['not-a-notification-type' as NotificationType],
        },
      ])
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_enum_value',
        message:
          "Invalid enum value. Expected 'CONFIRMATION_REQUEST' | 'DELETED_MULTISIG_TRANSACTION' | 'EXECUTED_MULTISIG_TRANSACTION' | 'INCOMING_ETHER' | 'INCOMING_TOKEN' | 'MESSAGE_CONFIRMATION_REQUEST' | 'MODULE_TRANSACTION', received 'not-a-notification-type'",
        options: [
          'CONFIRMATION_REQUEST',
          'DELETED_MULTISIG_TRANSACTION',
          'EXECUTED_MULTISIG_TRANSACTION',
          'INCOMING_ETHER',
          'INCOMING_TOKEN',
          'MESSAGE_CONFIRMATION_REQUEST',
          'MODULE_TRANSACTION',
        ],
        path: ['safes', 0, 'notificationTypes', 0],
        received: 'not-a-notification-type',
      },
    ]);
  });
});
