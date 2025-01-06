import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import {
  UpsertSubscriptionsSafesDto as DomainUpsertSubscriptionsSafesDto,
  UpsertSubscriptionsDto as DomainUpsertSubscriptionsDto,
} from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UUID } from 'crypto';

export class UpsertSubscriptionsSafesDto
  implements DomainUpsertSubscriptionsSafesDto
{
  @ApiProperty()
  chainId!: string;

  @ApiProperty()
  address!: `0x${string}`;

  @ApiProperty({
    isArray: true,
    enum: NotificationType,
    enumName: 'NotificationType',
  })
  notificationTypes!: Array<NotificationType>;
}

export class UpsertSubscriptionsDto implements DomainUpsertSubscriptionsDto {
  @ApiProperty()
  cloudMessagingToken!: string;

  @ApiProperty({ isArray: true, type: UpsertSubscriptionsSafesDto })
  safes!: Array<UpsertSubscriptionsSafesDto>;

  @ApiProperty({ enum: DeviceType, enumName: 'DeviceType' })
  deviceType!: DeviceType;

  @ApiPropertyOptional({ nullable: true, type: String })
  deviceUuid!: UUID;
}
