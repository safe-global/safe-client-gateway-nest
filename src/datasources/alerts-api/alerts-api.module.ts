import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { TenderlyApi } from '@/datasources/alerts-api/tenderly-api.service';

@Module({
  providers: [HttpErrorFactory, { provide: IAlertsApi, useClass: TenderlyApi }],
  exports: [IAlertsApi],
})
export class AlertsApiModule {}
