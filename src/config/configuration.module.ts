import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { validate } from '@/config/configuration.validator';
import { NestConfigurationService } from '@/config/nest.configuration.service';

/**
 * A {@link Global} Module which provides local configuration support via {@link IConfigurationService}
 * Feature Modules don't need to import this module directly in order to inject
 * the {@link IConfigurationService}.
 *
 * This module should be included in the "root" application module
 */
@Global()
@Module({})
export class ConfigurationModule {
  static register(configFactory: ConfigFactory): DynamicModule {
    return {
      module: ConfigurationModule,
      imports: [
        ConfigModule.forRoot({
          validate,
          load: [configFactory],
        }),
      ],
      providers: [
        { provide: IConfigurationService, useClass: NestConfigurationService },
      ],
      exports: [IConfigurationService],
    };
  }
}
