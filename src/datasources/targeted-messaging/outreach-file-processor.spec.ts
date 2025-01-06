import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { outreachFileBuilder } from '@/datasources/targeted-messaging/entities/__tests__/outreach-file.builder';
import { OutreachDbMapper } from '@/datasources/targeted-messaging/entities/outreach.db.mapper';
import type { TargetedSafe as DbTargetedSafe } from '@/datasources/targeted-messaging/entities/targeted-safe.entity';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { createOutreachDtoBuilder } from '@/domain/targeted-messaging/entities/tests/create-outreach.dto.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import { createHash } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import type postgres from 'postgres';
import { getAddress } from 'viem';
import { OutreachFileProcessor } from './outreach-file-processor';
import { SubmissionDbMapper } from '@/datasources/targeted-messaging/entities/submission.db.mapper';
import { TargetedSafeDbMapper } from '@/datasources/targeted-messaging/entities/targeted-safe.db.mapper';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockCloudStorageApiService = jest.mocked({
  getFileContent: jest.fn(),
} as jest.MockedObjectDeep<ICloudStorageApiService>);

function getChecksum(content: string): string {
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

describe('OutreachFileProcessor', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let fileProcessor: OutreachFileProcessor;
  let targetedMessagingDatasource: TargetedMessagingDatasource;
  const testDbFactory = new TestDbFactory();
  const baseDir = 'assets/targeted-messaging';
  const fileName = faker.system.commonFileName();
  const outreachFile = outreachFileBuilder().build();
  const contentString = JSON.stringify(outreachFile);
  const fileChecksum = getChecksum(contentString);

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    await sql`TRUNCATE TABLE submissions, targeted_safes, outreaches CASCADE`;
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
      if (key === 'targetedMessaging.fileStorage.type') return 'local';
      if (key === 'targetedMessaging.fileStorage.baseDir') return baseDir;
    });

    targetedMessagingDatasource = new TargetedMessagingDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      new CachedQueryResolver(mockLoggingService, fakeCacheService),
      mockConfigurationService,
      new OutreachDbMapper(),
      new SubmissionDbMapper(),
      new TargetedSafeDbMapper(),
    );

    fileProcessor = new OutreachFileProcessor(
      mockLoggingService,
      fakeCacheService,
      targetedMessagingDatasource,
      mockConfigurationService,
      mockCloudStorageApiService,
    );
  });

  beforeEach(async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(path.resolve(baseDir, fileName), contentString);
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE submissions, targeted_safes, outreaches CASCADE`;
    await rm(path.resolve(baseDir, fileName));
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  it('should not process Outreach data files of the lock is set', async () => {
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder().build(),
    );
    await fakeCacheService.hSet(lockCacheKey, 'true', 10);

    await fileProcessor.onModuleInit();

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
  });

  it('should fail if the Outreach does not have a sourceFile set', async () => {
    const expectedChecksum = faker.string.alphanumeric();
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceFile', null)
        .with('sourceFileChecksum', expectedChecksum)
        .with('targetAll', false)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `[Outreach ${created.id}] Error parsing data file: No source file`,
    );
  });

  it('should not attempt to process Outreach data files when tageting all safes', async () => {
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceFile', null)
        .with('sourceFileChecksum', null)
        .with('targetAll', true)
        .build(),
    );

    await fileProcessor.onModuleInit();

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      `[Outreach ${created.id}] Targeting all safes. No file to process`,
    );
  });

  it('should not process Outreach data files with bad checksum', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const expectedChecksum = faker.string.alphanumeric();
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', expectedChecksum)
        .with('targetAll', false)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(1);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `[Outreach ${created.id}] Error parsing data file: Checksum expected ${expectedChecksum}, but found ${fileChecksum}`,
    );
  });

  it('should fail if the Outreach data file is not a JSON', async () => {
    const badSourceFile = path.resolve(baseDir, 'yaml.yaml');
    try {
      const content = 'yaml: yaml';
      const hash = createHash('sha256');
      hash.update(content);
      const checksum = hash.digest('hex');
      await writeFile(badSourceFile, content);
      await targetedMessagingDatasource.createOutreach(
        createOutreachDtoBuilder()
          .with('sourceFile', badSourceFile)
          .with('sourceFileChecksum', checksum)
          .with('targetAll', false)
          .build(),
      );
      const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
      await fakeCacheService.deleteByKey(lockCacheKey.key);

      await fileProcessor.onModuleInit();

      expect(
        await targetedMessagingDatasource.getUnprocessedOutreaches(),
      ).toHaveLength(1);
      expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining('is not valid JSON'),
      );
    } finally {
      await rm(badSourceFile);
    }
  });

  it('should validate process Outreach data files', async () => {
    const badSourceFile = path.resolve(baseDir, 'bad.json');
    try {
      const content = '{ "bad": "json" }';
      const hash = createHash('sha256');
      hash.update(content);
      const checksum = hash.digest('hex');
      await writeFile(badSourceFile, content);
      const created = await targetedMessagingDatasource.createOutreach(
        createOutreachDtoBuilder()
          .with('sourceFile', badSourceFile)
          .with('sourceFileChecksum', checksum)
          .with('targetAll', false)
          .build(),
      );
      const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
      await fakeCacheService.deleteByKey(lockCacheKey.key);

      await fileProcessor.onModuleInit();

      expect(
        await targetedMessagingDatasource.getUnprocessedOutreaches(),
      ).toHaveLength(1);
      expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `[Outreach ${created.id}] Error parsing data file`,
        ),
      );
    } finally {
      await rm(badSourceFile);
    }
  });

  it('should update the Outreach accordingly to the data file', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', outreachFile.campaign_id)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .with('targetAll', false)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Outreach was updated with the contents of the data file
    const [updated] =
      await sql`SELECT * FROM outreaches WHERE id = ${created.id}`;
    expect(updated.name).toBe(outreachFile.campaign_name);
    expect(updated.team_name).toBe(outreachFile.team_name);
    expect(updated.start_date).toStrictEqual(outreachFile.start_date);
    expect(updated.end_date).toStrictEqual(outreachFile.end_date);
  });

  it('should add the Targeted Safes present in the data file', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', outreachFile.campaign_id)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .with('targetAll', false)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Targeted Safes were created
    const targetedSafes =
      await sql`SELECT * FROM targeted_safes WHERE outreach_id = ${created.id}`;
    expect(targetedSafes).toHaveLength(outreachFile.safe_addresses.length);
    expect(
      targetedSafes.every(
        (targetedSafe) => targetedSafe.outreach_id === created.id,
      ),
    ).toBeTruthy();
  });

  it('should checksum the Targeted Safes addresses in the data file', async () => {
    const outreachFile = outreachFileBuilder()
      .with(
        'safe_addresses',
        faker.helpers.multiple(
          () => faker.finance.ethereumAddress().toLowerCase() as `0x${string}`, // not checksummed
          { count: { min: 10, max: 50 } },
        ),
      )
      .build();
    const contentString = JSON.stringify(outreachFile);
    const fileChecksum = getChecksum(contentString);
    const sourceFile = path.resolve(baseDir, fileName);
    await writeFile(path.resolve(baseDir, fileName), contentString);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', outreachFile.campaign_id)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .with('targetAll', false)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Targeted Safes were created
    const targetedSafes: Array<DbTargetedSafe> =
      await sql`SELECT * FROM targeted_safes WHERE outreach_id = ${created.id}`;
    expect(targetedSafes).toHaveLength(outreachFile.safe_addresses.length);
    // assert the Targeted Safes addresses were checksummed
    expect(
      targetedSafes.every(
        (targetedSafe) =>
          getAddress(targetedSafe.address) === targetedSafe.address,
      ),
    ).toBeTruthy();
  });

  it('should mark the Outreach as processed and release the lock', async () => {
    const sourceFile = path.resolve(baseDir, fileName);
    const created = await targetedMessagingDatasource.createOutreach(
      createOutreachDtoBuilder()
        .with('sourceId', outreachFile.campaign_id)
        .with('sourceFile', sourceFile)
        .with('sourceFileChecksum', fileChecksum)
        .with('targetAll', false)
        .build(),
    );
    const lockCacheKey = CacheRouter.getOutreachFileProcessorCacheDir();
    await fakeCacheService.deleteByKey(lockCacheKey.key);

    await fileProcessor.onModuleInit();

    // assert the Outreach was marked as processed
    const [updated] =
      await sql`SELECT * FROM outreaches WHERE id = ${created.id}`;
    expect(updated.source_file_processed_date).not.toBeNull();
    expect(
      await targetedMessagingDatasource.getUnprocessedOutreaches(),
    ).toHaveLength(0);
    expect(await fakeCacheService.hGet(lockCacheKey)).toBeUndefined();
  });
});
