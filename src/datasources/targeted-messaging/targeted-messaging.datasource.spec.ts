import { TestDbFactory } from '@/__tests__/db.factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { OutreachDbMapper } from '@/datasources/targeted-messaging/entities/outreach.db.mapper';
import { SubmissionDbMapper } from '@/datasources/targeted-messaging/entities/submission.db.mapper';
import { TargetedSafeDbMapper } from '@/datasources/targeted-messaging/entities/targeted-safe.db.mapper';
import { TargetedMessagingDatasource } from '@/datasources/targeted-messaging/targeted-messaging.datasource';
import { createOutreachDtoBuilder } from '@/domain/targeted-messaging/entities/tests/create-outreach.dto.builder';
import { createTargetedSafesDtoBuilder } from '@/domain/targeted-messaging/entities/tests/create-target-safes.dto.builder';
import { SubmissionNotFoundError } from '@/domain/targeted-messaging/errors/submission-not-found.error';
import { TargetedSafeNotFoundError } from '@/domain/targeted-messaging/errors/targeted-safe-not-found.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker/.';
import type postgres from 'postgres';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('TargetedMessagingDataSource tests', () => {
  let fakeCacheService: FakeCacheService;
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  let target: TargetedMessagingDatasource;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    fakeCacheService = new FakeCacheService();
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
    await migrator.migrate();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
    });

    target = new TargetedMessagingDatasource(
      fakeCacheService,
      sql,
      mockLoggingService,
      new CachedQueryResolver(mockLoggingService, fakeCacheService),
      mockConfigurationService,
      new OutreachDbMapper(),
      new SubmissionDbMapper(),
      new TargetedSafeDbMapper(),
    );
  });

  beforeEach(async () => {
    await sql`TRUNCATE TABLE submissions, targeted_safes, outreaches CASCADE`;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  describe('getUnprocessedOutreaches', () => {
    it('gets unprocessed outreaches successfully', async () => {
      const outreaches = [
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', faker.date.recent())
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', faker.date.recent())
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', null)
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', faker.date.recent())
          .build(),
        createOutreachDtoBuilder()
          .with('sourceFileProcessedDate', null)
          .build(),
      ];
      for (const outreach of outreaches) {
        await target.createOutreach(outreach);
      }

      const result = await target.getUnprocessedOutreaches();

      // Only the outreaches with sourceFileProcessedDate as null are returned
      expect(result).toStrictEqual([
        expect.objectContaining(outreaches[2]),
        expect.objectContaining(outreaches[4]),
      ]);
    });
  });

  describe('createOutreach', () => {
    it('creates an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();

      const result = await target.createOutreach(dto);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        sourceId: dto.sourceId,
        type: dto.type,
        teamName: dto.teamName,
        sourceFile: dto.sourceFile,
        sourceFileProcessedDate: null,
        sourceFileChecksum: null,
        targetAll: dto.targetAll,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the creation fails', async () => {
      const dto = createOutreachDtoBuilder().build();

      await target.createOutreach(dto);

      // An outreach with the same name already exists
      await expect(target.createOutreach(dto)).rejects.toThrow(
        'Error creating outreach',
      );
    });
  });

  describe('getOutreachOrFail', () => {
    it('gets an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();
      const created = await target.createOutreach(dto);

      const result = await target.getOutreachOrFail(created.id);
      expect(result.targetAll).toStrictEqual(dto.targetAll);
    });

    it('throws if the outreach does not exist', async () => {
      const nonExistentId = faker.number.int({ min: 1000, max: 9999 });

      await expect(target.getOutreachOrFail(nonExistentId)).rejects.toThrow(
        'Outreach not found',
      );
    });
  });

  describe('updateOutreach', () => {
    it('should update an outreach successfully', async () => {
      const dto = createOutreachDtoBuilder().build();
      await target.createOutreach(dto);
      const updateOutreachDto = {
        sourceId: dto.sourceId,
        name: faker.string.alphanumeric(),
        startDate: faker.date.recent(),
        endDate: faker.date.recent(),
        teamName: faker.string.alphanumeric(),
        type: faker.string.alphanumeric(),
      };
      const result = await target.updateOutreach(updateOutreachDto);

      expect(result).toStrictEqual({
        id: expect.any(Number),
        name: updateOutreachDto.name,
        startDate: updateOutreachDto.startDate,
        endDate: updateOutreachDto.endDate,
        sourceId: updateOutreachDto.sourceId,
        type: updateOutreachDto.type,
        teamName: updateOutreachDto.teamName,
        sourceFile: dto.sourceFile,
        sourceFileProcessedDate: dto.sourceFileProcessedDate,
        sourceFileChecksum: dto.sourceFileChecksum,
        targetAll: dto.targetAll,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });
  });

  describe('createTargetedSafes', () => {
    it('adds targetedSafes successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();

      const result = await target.createTargetedSafes(createTargetedSafesDto);

      expect(result).toStrictEqual([
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: createTargetedSafesDto.addresses[0],
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        {
          id: expect.any(Number),
          outreachId: createTargetedSafesDto.outreachId,
          address: createTargetedSafesDto.addresses[1],
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
      ]);
    });

    it('fails if the outreach does not exist', async () => {
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('fails if the Safe was already targeted in the same outreach', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address, address])
        .build();

      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('fails if the Safe was already targeted in the same outreach (2)', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const address = getAddress(faker.finance.ethereumAddress());
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [address])
        .build();

      // Create the targeted safe
      const created = await target.createTargetedSafes(createTargetedSafesDto);
      expect(created).toHaveLength(1);

      // Fails when trying to create the same targeted safe
      await expect(
        target.createTargetedSafes(createTargetedSafesDto),
      ).rejects.toThrow('Error adding targeted Safes');
    });

    it('should clear the cache on targetedSafes creation', async () => {
      let cacheContent: string | undefined;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(createTargetedSafesDto);
      const cacheDir = new CacheDir(
        `targeted_messaging_targeted_safe_${outreach.id}`,
        createTargetedSafesDto.addresses[0],
      );

      // cache is empty
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });
      // cache is updated
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);

      // second call is cached
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });

      // Clear the cache by creating new targetedSafes
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
      const anotherCreateTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(anotherCreateTargetedSafesDto);
      // cache is cleared
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();

      // third call is not cached
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });
      // cache is updated
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
    });
  });

  describe('getTargetedSafe', () => {
    it('gets a targetedSafe successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      const result = await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });

      expect(result).toStrictEqual({
        id: targetedSafes[0].id,
        address: targetedSafes[0].address,
        outreachId: outreach.id,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a targetedSafe from cache', async () => {
      let cacheContent: string | undefined;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const cacheDir = new CacheDir(
        `targeted_messaging_targeted_safe_${outreach.id}`,
        createTargetedSafesDto.addresses[0],
      );

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });
      // cache is updated
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);

      // second call is cached
      const result = await target.getTargetedSafe({
        outreachId: outreach.id,
        safeAddress: createTargetedSafesDto.addresses[0],
      });

      expect(result).toStrictEqual(
        expect.objectContaining({
          id: targetedSafes[0].id,
          address: targetedSafes[0].address,
          outreachId: outreach.id,
        }),
      );
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
    });

    it('should not cache if the targetedSafe does not exist', async () => {
      let cacheContent: string | undefined;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const cacheDir = new CacheDir(
        `targeted_messaging_targeted_safe_${outreach.id}`,
        safeAddress,
      );

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
        }),
      ).rejects.toThrow(TargetedSafeNotFoundError);
      // second call is also not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress,
        }),
      ).rejects.toThrow(TargetedSafeNotFoundError);
      // cache is still empty
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
    });

    it('throws if the targetedSafe does not exist', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      await target.createTargetedSafes(createTargetedSafesDto);

      await expect(
        target.getTargetedSafe({
          outreachId: outreach.id,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).rejects.toThrow(TargetedSafeNotFoundError);
    });
  });

  describe('getSubmission', () => {
    it('creates a submission successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      const result = await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a submission successfully', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      const result = await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('gets a submission from cache', async () => {
      let cacheContent: string | undefined;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const cacheDir = new CacheDir(
        `targeted_messaging_submission_${outreach.id}`,
        `${createTargetedSafesDto.addresses[0]}_${signerAddress}`,
      );

      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });
      // second call is cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toHaveLength(1);
      const result = await target.getSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      expect(result).toStrictEqual({
        id: expect.any(Number),
        outreachId: outreach.id,
        targetedSafeId: targetedSafes[0].id,
        signerAddress,
        completionDate: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('throws if the submission does not exist', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );

      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress: getAddress(faker.finance.ethereumAddress()),
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
    });

    it('should not cache if the submission does not exist', async () => {
      let cacheContent: string | undefined;
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const cacheDir = new CacheDir(
        `targeted_messaging_submission_${outreach.id}`,
        `${createTargetedSafesDto.addresses[0]}_${signerAddress}`,
      );

      // first call is not cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
      // second call is also not  cached
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
      await expect(
        target.getSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
      // cache is still empty
      cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();
    });

    it('throws if trying to create a submission for the same targetedSafe and signerAddress', async () => {
      const createOutreachDto = createOutreachDtoBuilder().build();
      const outreach = await target.createOutreach(createOutreachDto);
      const createTargetedSafesDto = createTargetedSafesDtoBuilder()
        .with('outreachId', outreach.id)
        .with('addresses', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .build();
      const targetedSafes = await target.createTargetedSafes(
        createTargetedSafesDto,
      );
      const signerAddress = getAddress(faker.finance.ethereumAddress());

      // First submission
      await target.createSubmission({
        targetedSafe: targetedSafes[0],
        signerAddress,
      });

      // Second submission - same targetedSafe and signerAddress
      await expect(
        target.createSubmission({
          targetedSafe: targetedSafes[0],
          signerAddress,
        }),
      ).rejects.toThrow('Error creating submission');
    });
  });
});
