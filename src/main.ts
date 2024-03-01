import { AppModule } from '@/app.module';
import { DefaultAppProvider } from '@/app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';

async function bootstrap(): Promise<void> {
  const app = await new DefaultAppProvider().provide(AppModule.register());

  const configurationService: IConfigurationService =
    app.get<IConfigurationService>(IConfigurationService);
  const applicationPort: string =
    configurationService.getOrThrow('applicationPort');

  await app.listen(applicationPort);
}

bootstrap();
