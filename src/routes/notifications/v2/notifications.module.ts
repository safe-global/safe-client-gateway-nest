import { Module } from '@nestjs/common';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import { NotificationsControllerV2 } from '@/routes/notifications/v2/notifications.controller';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';

@Module({
  imports: [NotificationsRepositoryV2Module, AuthRepositoryModule],
  controllers: [NotificationsControllerV2],
  providers: [NotificationsServiceV2, AuthGuard],
  // Export the controller to enable compatibility with V1.
  exports: [NotificationsServiceV2],
})
export class NotificationsModuleV2 {}
