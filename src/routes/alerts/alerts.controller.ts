import { Controller, Post, HttpCode, Body, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Alert } from '@/routes/alerts/entities/alert.dto.entity';
import { AlertValidationPipe } from '@/routes/alerts/pipes/alert-validation.pipe';
import { AlertsService } from '@/routes/alerts/alerts.service';
import { AlertsRouteGuard } from '@/routes/alerts/guards/alerts-route.guard';
import { TenderlySignatureGuard } from '@/routes/alerts/guards/tenderly-signature.guard';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @UseGuards(AlertsRouteGuard)
  @UseGuards(TenderlySignatureGuard)
  @Post('/alerts')
  @HttpCode(202)
  async postAlert(
    @Body(AlertValidationPipe)
    alertPayload: Alert,
  ): Promise<void> {
    this.alertsService.onAlert(alertPayload);
  }
}
