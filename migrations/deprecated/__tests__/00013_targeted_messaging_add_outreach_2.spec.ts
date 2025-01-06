import { TestDbFactory } from '@/__tests__/db.factory';
import { PostgresDatabaseMigrator } from '@/datasources/db/v1/postgres-database.migrator';
import { faker } from '@faker-js/faker';
import type postgres from 'postgres';
import type { Sql } from 'postgres';

describe('Migration 00013_targeted_messaging_add_outreach_2', () => {
  let sql: postgres.Sql;
  let migrator: PostgresDatabaseMigrator;
  const testDbFactory = new TestDbFactory();

  beforeAll(async () => {
    sql = await testDbFactory.createTestDatabase(faker.string.uuid());
    migrator = new PostgresDatabaseMigrator(sql);
  });

  afterAll(async () => {
    await testDbFactory.destroyTestDatabase(sql);
  });

  it('runs successfully', async () => {
    const result = await migrator.test({
      migration: '00013_targeted_messaging_add_outreach_2',
      before: async (sql: Sql) => {
        await sql`DELETE FROM outreaches`;
      },
      after: async (sql: Sql) => {
        return {
          outreaches: {
            rows: await sql`SELECT * FROM outreaches`,
          },
        };
      },
    });

    expect(result.after).toStrictEqual({
      outreaches: {
        rows: [
          {
            id: expect.any(Number),
            source_id: 2,
            name: 'micro-campaign',
            start_date: new Date('2025-01-01'),
            end_date: new Date('2025-03-01'),
            type: '',
            team_name: '',
            source_file: null,
            source_file_checksum: null,
            source_file_processed_date: null,
            target_all: true,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          },
        ],
      },
    });
  });
});
