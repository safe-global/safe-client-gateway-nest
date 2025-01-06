import { Module } from '@nestjs/common';
import { NotificationsController } from '@/routes/notifications/v1/notifications.controller';
import { NotificationsService } from '@/routes/notifications/v1/notifications.service';
import { NotificationsRepositoryModule } from '@/domain/notifications/v1/notifications.repository.interface';
import { NotificationsModuleV2 } from '@/routes/notifications/v2/notifications.module';

@Module({
  // Adding NotificationModuleV2 to ensure compatibility with V1.
  // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
  imports: [NotificationsRepositoryModule, NotificationsModuleV2],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
