import { INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { json } from 'express';

function configureVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
  });
}

export function configureShutdownHooks(app: INestApplication): void {
  app.enableShutdownHooks();
}

function configureSwagger(app: INestApplication): void {
  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );

  const config = new DocumentBuilder()
    .setTitle('Safe Client Gateway')
    .setVersion(configurationService.get('about.version') ?? '')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('index.html', app, document, {
    customfavIcon: '/favicon.png',
    customSiteTitle: 'Safe Client Gateway',
    customCss: `.topbar-wrapper img { content:url(\'logo.svg\'); }`,
  });
}

function configureRequestBodyLimit(app: INestApplication): void {
  const configurationService = app.get<IConfigurationService>(
    IConfigurationService,
  );

  const jsonBodySizeLimit =
    configurationService.get<string>('express.jsonLimit');
  if (jsonBodySizeLimit) {
    app.use(json({ limit: jsonBodySizeLimit }));
  }
}

export const DEFAULT_CONFIGURATION: ((app: INestApplication) => void)[] = [
  configureVersioning,
  configureShutdownHooks,
  configureSwagger,
  configureRequestBodyLimit,
];

/**
 * The main goal of {@link AppProvider} is to provide
 * a {@link INestApplication}.
 *
 * Extensions of this class should return the application in
 * {@link getApp}.
 *
 * Each provider should have a {@link configuration} which specifies
 * the steps taken to configure the application
 */
export abstract class AppProvider {
  protected abstract readonly configuration: ((
    app: INestApplication,
  ) => void)[];

  public async provide(module: any): Promise<INestApplication> {
    const app = await this.getApp(module);
    this.configuration.forEach((f) => f(app));
    return app;
  }

  protected abstract getApp(module: any): Promise<INestApplication>;
}

/**
 * The default {@link AppProvider}
 *
 * This provider should be used to retrieve the actual implementation of the
 * service
 */
export class DefaultAppProvider extends AppProvider {
  protected readonly configuration: ((app: INestApplication) => void)[] =
    DEFAULT_CONFIGURATION;

  protected getApp(module: any): Promise<INestApplication> {
    return NestFactory.create(module);
  }
}
