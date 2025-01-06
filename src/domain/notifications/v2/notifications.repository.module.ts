import { PushNotificationsApiModule } from '@/datasources/push-notifications-api/push-notifications-api.module';
import { NotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository';
import { Module } from '@nestjs/common';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity.db';
import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { NotificationSubscriptionNotificationType } from '@/datasources/notifications/entities/notification-subscription-notification-type.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    PushNotificationsApiModule,
    TypeOrmModule.forFeature([
      NotificationType,
      NotificationDevice,
      NotificationSubscription,
      NotificationSubscriptionNotificationType,
    ]),
  ],
  providers: [
    {
      provide: INotificationsRepositoryV2,
      useClass: NotificationsRepositoryV2,
    },
  ],
  exports: [INotificationsRepositoryV2],
})
export class NotificationsRepositoryV2Module {}
