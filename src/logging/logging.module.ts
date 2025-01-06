import { Global, Module } from '@nestjs/common';
import winston from 'winston';
import Transport from 'winston-transport';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LoggingService } from '@/logging/logging.interface';
import { RequestScopedLoggingService } from '@/logging/logging.service';

/**
 * Provides a new instance of a Winston logger using the provided {@link transports}
 *
 * @param transports - the logger transports to be used in the winston instance
 * @param configurationService - the configuration service to retrieve service-level settings
 */
function winstonFactory(
  transports: Array<Transport> | Transport,
  configurationService: IConfigurationService,
): winston.Logger {
  return winston.createLogger({
    transports: transports,
    silent: configurationService.getOrThrow<boolean>('log.silent'),
  });
}

const LoggerTransports = Symbol('LoggerTransports');

/**
 * Factory which provides a collection of transports to be used by the
 * logger instance
 */
function winstonTransportsFactory(
  configurationService: IConfigurationService,
): Array<Transport> | Transport {
  const prettyColorize =
    configurationService.getOrThrow<boolean>('log.prettyColorize');
  return new winston.transports.Console({
    level: configurationService.getOrThrow<string>('log.level'),
    format: prettyColorize
      ? winston.format.prettyPrint({ colorize: true })
      : winston.format.json(),
  });
}

/**
 * Module for logging messages throughout the application.
 *
 * Provides the RequestScopedLoggingService which logs the current time and request ID with every message.
 */
@Global()
@Module({
  providers: [
    { provide: LoggingService, useClass: RequestScopedLoggingService },
    {
      provide: LoggerTransports,
      useFactory: winstonTransportsFactory,
      inject: [IConfigurationService],
    },
    {
      provide: 'Logger',
      useFactory: winstonFactory,
      inject: [LoggerTransports, IConfigurationService],
    },
  ],
  exports: [LoggingService],
})
export class RequestScopedLoggingModule {}
