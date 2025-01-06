import { IConfigurationService } from '@/config/configuration.service.interface';
import { FileStorageType } from '@/config/entities/schemas/configuration.schema';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { OutreachFileSchema } from '@/datasources/targeted-messaging/entities/outreach-file.entity';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

@Injectable()
export class OutreachFileProcessor implements OnModuleInit {
  private readonly storageType: FileStorageType;
  private readonly localBaseDir: string;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(ITargetedMessagingDatasource)
    private readonly datasource: ITargetedMessagingDatasource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ICloudStorageApiService)
    private readonly cloudStorageApiService: ICloudStorageApiService,
  ) {
    this.storageType = this.configurationService.getOrThrow<FileStorageType>(
      'targetedMessaging.fileStorage.type',
    );
    this.localBaseDir = this.configurationService.getOrThrow<string>(
      'targetedMessaging.fileStorage.local.baseDir',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      const lockCacheDir = CacheRouter.getOutreachFileProcessorCacheDir();
      const lock = await this.cacheService.hGet(lockCacheDir);
      if (!lock) {
        await this.cacheService.hSet(lockCacheDir, 'true', MAX_TTL);
        await this.processOutreachFiles();
      }
    } catch (err) {
      this.loggingService.error(
        `Error processing outreach files: ${asError(err).message}`,
      );
    } finally {
      await this.cacheService.deleteByKey(
        CacheRouter.getOutreachFileProcessorCacheKey(),
      );
    }
  }

  private async processOutreachFiles(): Promise<void> {
    const outreaches = await this.datasource.getUnprocessedOutreaches();
    for (const outreach of outreaches) {
      if (outreach.targetAll) {
        this.loggingService.info(
          `[Outreach ${outreach.id}] Targeting all safes. No file to process`,
        );
      } else {
        this.loggingService.info(
          `[Outreach ${outreach.id}] Processing outreach ${outreach.sourceId}`,
        );
        await this.processOutreach(outreach);
      }
    }
  }

  private async processOutreach(outreach: Outreach): Promise<void> {
    try {
      const data = await this.getDataFromFile(outreach);
      const json = JSON.parse(data);
      const outreachData = OutreachFileSchema.parse(json);
      await this.datasource.updateOutreach({
        name: outreachData.campaign_name,
        startDate: outreachData.start_date,
        endDate: outreachData.end_date,
        sourceId: outreachData.campaign_id,
        type: 'new_outreach',
        teamName: outreachData.team_name,
      });
      const createdTargetedSafes = await this.datasource.createTargetedSafes({
        outreachId: outreach.id,
        addresses: outreachData.safe_addresses,
      });
      this.loggingService.info(
        `[Outreach ${outreach.id}] ${createdTargetedSafes.length} targeted safes created`,
      );
      await this.datasource.markOutreachAsProcessed(outreach);
      this.loggingService.info(
        `[Outreach ${outreach.id}] Outreach ${outreach.sourceId} was processed`,
      );
    } catch (err) {
      this.loggingService.error(
        `[Outreach ${outreach.id}] Error parsing data file: ${asError(err).message}`,
      );
    }
  }

  private async getDataFromFile(outreach: Outreach): Promise<string> {
    if (!outreach.sourceFile) {
      throw new Error('No source file');
    }

    const data =
      this.storageType === 'aws'
        ? await this.cloudStorageApiService.getFileContent(outreach.sourceFile)
        : await this.getLocalFileData(outreach.sourceFile);

    const checksum = this.checksumData(data);
    if (checksum !== outreach.sourceFileChecksum) {
      throw new Error(
        `Checksum expected ${outreach.sourceFileChecksum}, but found ${checksum}`,
      );
    }

    this.loggingService.info(
      `[Outreach ${outreach.id}] Data file ${outreach.sourceFile} read from ${this.storageType}`,
    );

    return data;
  }

  private async getLocalFileData(sourceFile: string): Promise<string> {
    try {
      return await readFile(
        path.resolve(this.localBaseDir, sourceFile),
        'utf-8',
      );
    } catch (err) {
      throw new Error(
        `Error reading file ${sourceFile}: ${asError(err).message}`,
      );
    }
  }

  private checksumData(dataString: string): string {
    const hash = createHash('sha256');
    hash.update(dataString);
    return hash.digest('hex');
  }
}
