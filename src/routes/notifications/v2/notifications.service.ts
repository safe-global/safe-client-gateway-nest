import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { UpsertSubscriptionsDto } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { Inject, Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';

@Injectable()
export class NotificationsServiceV2 {
  constructor(
    @Inject(INotificationsRepositoryV2)
    private readonly notificationsRepository: INotificationsRepositoryV2,
  ) {}

  async upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }> {
    return this.notificationsRepository.upsertSubscriptions(args);
  }

  async getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>> {
    return await this.notificationsRepository.getSafeSubscription(args);
  }

  async deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    await this.notificationsRepository.deleteSubscription(args);
  }

  async deleteDevice(deviceUuid: UUID): Promise<void> {
    await this.notificationsRepository.deleteDevice(deviceUuid);
  }
}
