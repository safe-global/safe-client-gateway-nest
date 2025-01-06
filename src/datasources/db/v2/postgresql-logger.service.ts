import { type ILoggingService } from '@/logging/logging.interface';
import { Injectable } from '@nestjs/common';
import {
  AbstractLogger,
  type LoggerOptions,
  type LogLevel,
  type LogMessage,
} from 'typeorm';

@Injectable()
export class PostgresqlLogger extends AbstractLogger {
  public constructor(
    private readonly loggingService: ILoggingService,
    public options?: LoggerOptions,
  ) {
    super(options);
  }
  /**
   * Write log to specific output.
   *
   * This is taken from the TypeOrm default implementation, check out {@link https://orkhan.gitbook.io/typeorm/docs/logging}
   */
  protected writeLog(
    level: LogLevel,
    logMessage: LogMessage | Array<LogMessage>,
  ): void {
    const messages = this.prepareLogMessages(logMessage, {
      highlightSql: false,
    });

    for (const message of messages) {
      switch (message.type ?? level) {
        case 'log':
        case 'schema-build':
        case 'migration':
          this.loggingService.info(`${message.prefix} - ${message.message}`);
          break;

        case 'info':
        case 'query':
          if (message.prefix) {
            this.loggingService.info(`${message.prefix} - ${message.message}`);
          } else {
            this.loggingService.info(message.message);
          }
          break;

        case 'warn':
        case 'query-slow':
          if (message.prefix) {
            this.loggingService.warn(`${message.prefix} - ${message.message}`);
          } else {
            this.loggingService.warn(message.message);
          }
          break;

        case 'error':
        case 'query-error':
          if (message.prefix) {
            this.loggingService.error(`${message.prefix} - ${message.message}`);
          } else {
            this.loggingService.error(message.message);
          }
          break;
      }
    }
  }

  /**
   * Logs the executed query along with the request URL if available.
   *
   * @param {string} query - The SQL query string that is being executed.
   *
   * @returns {void} This method does not return anything.
   */
  public logQuery(query: string): void {
    if (this.loggingService) {
      this.loggingService.debug(`executing query: '${query}'`);
    }
  }
}
