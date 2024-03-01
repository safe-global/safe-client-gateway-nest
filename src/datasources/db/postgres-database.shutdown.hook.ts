import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import postgres from 'postgres';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Injectable()
export class PostgresDatabaseShutdownHook implements OnModuleDestroy {
  private static readonly CONNECTION_CLOSE_TIMEOUT_IN_SECONDS = 5;

  constructor(
    @Inject('DB_INSTANCE') private readonly db: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.loggingService.info('Closing database connection');
    // Resolves when all queries are finished and the underlying connections are closed
    await this.db.end({
      // Any pending queries will be rejected once the timeout is reached
      timeout: PostgresDatabaseShutdownHook.CONNECTION_CLOSE_TIMEOUT_IN_SECONDS,
    });
    this.loggingService.info('Database connection closed');
  }
}
