import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { ICachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver.interface';
import { OutreachDbMapper } from '@/datasources/targeted-messaging/entities/outreach.db.mapper';
import { Outreach as DbOutreach } from '@/datasources/targeted-messaging/entities/outreach.entity';
import { SubmissionDbMapper } from '@/datasources/targeted-messaging/entities/submission.db.mapper';
import { Submission as DbSubmission } from '@/datasources/targeted-messaging/entities/submission.entity';
import { TargetedSafeDbMapper } from '@/datasources/targeted-messaging/entities/targeted-safe.db.mapper';
import { TargetedSafe as DbTargetedSafe } from '@/datasources/targeted-messaging/entities/targeted-safe.entity';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { CreateOutreachDto } from '@/domain/targeted-messaging/entities/create-outreach.dto.entity';
import { CreateTargetedSafesDto } from '@/domain/targeted-messaging/entities/create-targeted-safes.dto.entity';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { UpdateOutreachDto } from '@/domain/targeted-messaging/entities/update-outreach.dto.entity';
import { SubmissionNotFoundError } from '@/domain/targeted-messaging/errors/submission-not-found.error';
import { TargetedSafeNotFoundError } from '@/domain/targeted-messaging/errors/targeted-safe-not-found.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class TargetedMessagingDatasource
  implements ITargetedMessagingDatasource
{
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(ICachedQueryResolver)
    private readonly cachedQueryResolver: CachedQueryResolver,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly outreachDbMapper: OutreachDbMapper,
    private readonly submissionDbMapper: SubmissionDbMapper,
    private readonly targetedSafeDbMapper: TargetedSafeDbMapper,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async createOutreach(
    createOutreachDto: CreateOutreachDto,
  ): Promise<Outreach> {
    const [dbOutreach] = await this.sql<Array<DbOutreach>>`
      INSERT INTO outreaches (name, start_date, end_date, source_id, type, team_name, source_file, target_all, source_file_processed_date, source_file_checksum)
      VALUES (
        ${createOutreachDto.name}, 
        ${createOutreachDto.startDate}, 
        ${createOutreachDto.endDate}, 
        ${createOutreachDto.sourceId}, 
        ${createOutreachDto.type}, 
        ${createOutreachDto.teamName},
        ${createOutreachDto.sourceFile},
        ${createOutreachDto.targetAll},
        ${createOutreachDto.sourceFileProcessedDate},
        ${createOutreachDto.sourceFileChecksum}
        )
      RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error creating outreach: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException('Error creating outreach');
    });

    return this.outreachDbMapper.map(dbOutreach);
  }

  async updateOutreach(
    updateOutreachDto: UpdateOutreachDto,
  ): Promise<Outreach> {
    const [dbOutreach] = await this.sql<Array<DbOutreach>>`
    UPDATE outreaches SET
      name = ${updateOutreachDto.name},
      start_date = ${updateOutreachDto.startDate},
      end_date = ${updateOutreachDto.endDate},
      type = ${updateOutreachDto.type},
      team_name = ${updateOutreachDto.teamName}
    WHERE source_id = ${updateOutreachDto.sourceId}
    RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error creating outreach: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException('Error updating outreach');
    });

    return this.outreachDbMapper.map(dbOutreach);
  }

  async getOutreachOrFail(outreachId: number): Promise<Outreach> {
    const [dbOutreach] = await this.sql<
      Array<DbOutreach>
    >`SELECT target_all FROM outreaches WHERE id = ${outreachId}`.catch(
      (err) => {
        this.loggingService.warn(
          `Error getting outreach: ${asError(err).message}`,
        );
        throw new UnprocessableEntityException('Error getting outreach');
      },
    );

    if (!dbOutreach) {
      throw new NotFoundException('Outreach not found');
    }

    return this.outreachDbMapper.map(dbOutreach);
  }

  async getUnprocessedOutreaches(): Promise<Array<Outreach>> {
    const dbOutreaches = await this.sql<
      Array<DbOutreach>
    >`SELECT * FROM outreaches WHERE source_file_processed_date IS NULL`.catch(
      (err) => {
        this.loggingService.warn(
          `Error getting unprocessed outreaches: ${asError(err).message}`,
        );
        throw new UnprocessableEntityException(
          'Error getting unprocessed outreaches',
        );
      },
    );

    return dbOutreaches.map((dbOutreach) =>
      this.outreachDbMapper.map(dbOutreach),
    );
  }

  async markOutreachAsProcessed(outreach: Outreach): Promise<Outreach> {
    const [updatedDbOutreach] = await this.sql<Array<DbOutreach>>`
      UPDATE outreaches
      SET source_file_processed_date = ${new Date()}
      WHERE id = ${outreach.id}
      RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error marking outreach as processed: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException(
        'Error marking outreach as processed',
      );
    });

    return this.outreachDbMapper.map(updatedDbOutreach);
  }

  async createTargetedSafes(
    createTargetedSafesDto: CreateTargetedSafesDto,
  ): Promise<Array<TargetedSafe>> {
    const targetedSafes = await this.sql.begin(async (sql) => {
      const inserted = await sql<[{ id: number }]>`
        INSERT INTO targeted_safes
        ${sql(
          createTargetedSafesDto.addresses.map((address) => ({
            outreach_id: createTargetedSafesDto.outreachId,
            address,
          })),
        )}
        RETURNING id`.catch((err) => {
        this.loggingService.warn(
          `Error adding targeted Safes: ${asError(err).message}`,
        );
        throw new UnprocessableEntityException('Error adding targeted Safes');
      });

      const dbTargetedSafes = await sql<
        Array<DbTargetedSafe>
      >`SELECT * FROM targeted_safes WHERE id = ANY(${inserted.map((i) => i.id)})`;

      return dbTargetedSafes.map((dbTargetedSafe) =>
        this.targetedSafeDbMapper.map(dbTargetedSafe),
      );
    });

    await this.cacheService.deleteByKey(
      CacheRouter.getTargetedSafeCacheKey(createTargetedSafesDto.outreachId),
    );

    return targetedSafes;
  }

  async getTargetedSafe(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe> {
    const [dbTargetedSafe] = await this.cachedQueryResolver.get<
      Array<DbTargetedSafe>
    >({
      cacheDir: CacheRouter.getTargetedSafeCacheDir(args),
      query: this.sql`
        SELECT * FROM targeted_safes
        WHERE outreach_id = ${args.outreachId} AND address = ${args.safeAddress}`,
      ttl: this.defaultExpirationTimeInSeconds,
    });

    if (!dbTargetedSafe) {
      throw new TargetedSafeNotFoundError();
    }

    return this.targetedSafeDbMapper.map(dbTargetedSafe);
  }

  async createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const [dbSubmission] = await this.sql<Array<DbSubmission>>`
      INSERT INTO submissions (targeted_safe_id, signer_address, completion_date)
      VALUES (${args.targetedSafe.id}, ${args.signerAddress}, ${new Date()})
      RETURNING *`.catch((err) => {
      this.loggingService.warn(
        `Error creating submission: ${asError(err).message}`,
      );
      throw new UnprocessableEntityException('Error creating submission');
    });
    await this.cacheService.deleteByKey(
      CacheRouter.getSubmissionCacheKey(args.targetedSafe.outreachId),
    );

    return this.submissionDbMapper.map(dbSubmission, args.targetedSafe);
  }

  async getSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const [dbSubmission] = await this.cachedQueryResolver.get<
      Array<DbSubmission>
    >({
      cacheDir: CacheRouter.getSubmissionCacheDir({
        outreachId: args.targetedSafe.outreachId,
        safeAddress: args.targetedSafe.address,
        signerAddress: args.signerAddress,
      }),
      query: this.sql`
        SELECT * FROM submissions
        WHERE targeted_safe_id = ${args.targetedSafe.id} AND signer_address = ${args.signerAddress}`,
      ttl: this.defaultExpirationTimeInSeconds,
    });

    if (!dbSubmission) {
      throw new SubmissionNotFoundError();
    }

    return this.submissionDbMapper.map(dbSubmission, args.targetedSafe);
  }
}
