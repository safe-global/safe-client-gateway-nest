import { CanActivate, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class AlertsRouteGuard implements CanActivate {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  canActivate(): boolean {
    return this.configurationService.getOrThrow<boolean>('features.email');
  }
}
