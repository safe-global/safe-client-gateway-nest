import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { z } from 'zod';

const UpsertSubscriptionsDtoSafesSchema = z.object({
  chainId: z.string(),
  address: AddressSchema,
  notificationTypes: z.array(z.nativeEnum(NotificationType)),
});

export const UpsertSubscriptionsDtoSchema = z.object({
  cloudMessagingToken: z.string(),
  safes: z.array(UpsertSubscriptionsDtoSafesSchema),
  deviceType: z.nativeEnum(DeviceType),
  deviceUuid: UuidSchema.nullish().default(null),
});

export type UpsertSubscriptionsSafesDto = z.infer<
  typeof UpsertSubscriptionsDtoSafesSchema
>;

export type UpsertSubscriptionsDto = z.infer<
  typeof UpsertSubscriptionsDtoSchema
>;
