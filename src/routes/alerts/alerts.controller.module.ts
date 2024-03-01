import { Module } from '@nestjs/common';
import { AlertsController } from '@/routes/alerts/alerts.controller';
import { AlertsService } from '@/routes/alerts/alerts.service';
import { AlertsDomainModule } from '@/domain/alerts/alerts.domain.module';

@Module({
  imports: [AlertsDomainModule],
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsControllerModule {}
