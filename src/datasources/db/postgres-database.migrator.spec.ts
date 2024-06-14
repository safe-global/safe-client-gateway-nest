import configuration from '@/config/entities/__tests__/configuration';
import postgres from 'postgres';
import path from 'node:path';
import fs from 'node:fs';
import { PostgresDatabaseMigrator } from '@/datasources/db/postgres-database.migrator';

const folder = path.join(__dirname, 'migrations');
const migrations: Array<{
  name: string;
  file: { name: string; contents: string };
}> = [
  {
    name: '00001_initial',
    file: {
      name: 'index.sql',
      contents: `drop table if exists test;
                 create table test (
                   a text,
                   b int
                 );

                 insert into test (a, b) values ('hello', 1337);`,
    },
  },
  {
    name: '00002_update',
    file: {
      name: 'index.js',
      contents: `module.exports = async function(sql) {
                  await sql\`
                    alter table test add column c timestamp with time zone
                  \`

                  await sql\`
                    insert into test (a, b, c) values ('world', 69420, ${'${new Date()}'})
                  \`
                }`,
    },
  },
  {
    name: '00003_delete',
    file: {
      name: 'index.sql',
      contents: 'drop table test;',
    },
  },
];

describe('PostgresDatabaseMigrator tests', () => {
  let sql: postgres.Sql;
  let target: PostgresDatabaseMigrator;

  beforeEach(async () => {
    const config = configuration();

    const isCIContext = process.env.CI?.toLowerCase() === 'true';

    sql = postgres({
      host: config.db.postgres.host,
      port: parseInt(config.db.postgres.port),
      db: config.db.postgres.database,
      user: config.db.postgres.username,
      password: config.db.postgres.password,
      // If running on a CI context (e.g.: GitHub Actions),
      // disable certificate pinning for the test execution
      ssl:
        isCIContext || !config.db.postgres.ssl.enabled
          ? false
          : {
              requestCert: config.db.postgres.ssl.requestCert,
              rejectUnauthorized: config.db.postgres.ssl.rejectUnauthorized,
              ca: fs.readFileSync(
                path.join(process.cwd(), './db_config/test/server.crt'),
                'utf8',
              ),
            },
    });

    target = new PostgresDatabaseMigrator(sql);
  });

  afterEach(async () => {
    // Drop example table after each test
    await sql`drop table if exists tests`;

    // Close connection after each test
    await sql.end();

    // Remove migrations folder after each test
    fs.rmSync(folder, { recursive: true, force: true });
  });

  describe('migrate', () => {
    afterEach(async () => {
      // Drop migrations table after each test
      await sql`drop table if exists migrations`;
    });

    it('should successfully migrate and keep track of last run migration', async () => {
      // Create migration folders and files
      for (const { name, file } of migrations) {
        const migrationPath = path.join(folder, name);
        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      // Test migration and expect migrations to be recorded
      await expect(target.migrate(folder)).resolves.not.toThrow();
      await expect(sql`SELECT * FROM migrations`).resolves.toStrictEqual([
        {
          id: 1,
          name: 'initial',
          created_at: expect.any(Date),
        },
        {
          id: 2,
          name: 'update',
          created_at: expect.any(Date),
        },
        {
          id: 3,
          name: 'delete',
          created_at: expect.any(Date),
        },
      ]);
    });

    it('should migrate from the last run migration', async () => {
      const [initialMigration, ...remainingMigrations] = migrations;

      // Create initial migration folder and file
      const initialMigrationPath = path.join(folder, initialMigration.name);
      fs.mkdirSync(initialMigrationPath, { recursive: true });
      fs.writeFileSync(
        path.join(initialMigrationPath, initialMigration.file.name),
        initialMigration.file.contents,
      );

      // Migrate (only initial migration should be recorded)
      await target.migrate(folder);
      const recordedMigrations = await sql`SELECT * FROM migrations`;
      expect(recordedMigrations).toStrictEqual([
        {
          id: 1,
          name: 'initial',
          created_at: expect.any(Date),
        },
      ]);

      // Add remaining migrations
      for (const { name, file } of remainingMigrations) {
        const migrationPath = path.join(folder, name);

        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      // Migrate from last run migration
      await target.migrate(folder);
      await expect(sql`SELECT * FROM migrations`).resolves.toStrictEqual([
        {
          id: 1,
          name: 'initial',
          // Was not run again
          created_at: recordedMigrations[0].created_at,
        },
        {
          id: 2,
          name: 'update',
          created_at: expect.any(Date),
        },
        {
          id: 3,
          name: 'delete',
          created_at: expect.any(Date),
        },
      ]);
    });

    it('throws if there are no migrations', async () => {
      // Create empty migrations folder
      fs.mkdirSync(folder, { recursive: true });

      await expect(target.migrate(folder)).rejects.toThrow(
        'No migrations found',
      );
    });

    it('throws if there is inconsistent numbering', async () => {
      // Omit second migration to create inconsistency
      const [migration1, _, migration3] = migrations;

      // Add inconsistent migration folders and file
      for (const { name, file } of [migration1, migration3]) {
        const migrationPath = path.join(folder, name);

        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      await expect(target.migrate(folder)).rejects.toThrow(
        'Migrations numbered inconsistency',
      );
    });
  });

  describe('test', () => {
    it('should test migration', async () => {
      const [migration1, migration2, migration3] = migrations;

      // Create migration folder with first migration
      const migration1Path = path.join(folder, migration1.name);
      fs.mkdirSync(migration1Path, { recursive: true });
      fs.writeFileSync(
        path.join(migration1Path, migration1.file.name),
        migration1.file.contents,
      );

      // Test first migration
      await expect(
        target.test({
          migration: migration1.name,
          before: (sql) => sql`SELECT * FROM test`,
          after: (sql) => sql`SELECT * FROM test`,
          folder,
        }),
      ).resolves.toStrictEqual({
        before: undefined,
        after: [
          {
            a: 'hello',
            b: 1337,
          },
        ],
      });

      // Should not track migrations when testing
      await expect(sql`SELECT * FROM migrations`).rejects.toThrow(
        'does not exist',
      );

      // Add second migration
      const migration2Path = path.join(folder, migration2.name);
      fs.mkdirSync(migration2Path, { recursive: true });
      fs.writeFileSync(
        path.join(migration2Path, migration2.file.name),
        migration2.file.contents,
      );

      // Test up to second migration
      await expect(
        target.test({
          migration: migration2.name,
          before: (sql) => sql`SELECT * FROM test`,
          after: (sql) => sql`SELECT * FROM test`,
          folder,
        }),
      ).resolves.toStrictEqual({
        before: [
          {
            a: 'hello',
            b: 1337,
          },
        ],
        after: [
          {
            a: 'hello',
            b: 1337,
            c: null,
          },
          {
            a: 'world',
            b: 69420,
            c: expect.any(Date),
          },
        ],
      });

      // Add third migration
      const migration3Path = path.join(folder, migration3.name);
      fs.mkdirSync(migration3Path, { recursive: true });
      fs.writeFileSync(
        path.join(migration3Path, migration3.file.name),
        migration3.file.contents,
      );

      // Test all migrations
      await expect(
        target.test({
          migration: migration3.name,
          before: (sql) => sql`SELECT * FROM test`,
          after: (sql) => sql`SELECT * FROM test`,
          folder,
        }),
      ).resolves.toStrictEqual({
        before: [
          {
            a: 'hello',
            b: 1337,
            c: null,
          },
          {
            a: 'world',
            b: 69420,
            c: expect.any(Date),
          },
        ],
        // Final migration drops table
        after: undefined,
      });
    });

    it('throws if there are no migrations', async () => {
      // Create empty migrations folder
      fs.mkdirSync(folder, { recursive: true });

      await expect(
        target.test({ migration: '', after: Promise.resolve, folder }),
      ).rejects.toThrow('No migrations found');

      // Remove migrations folder
      fs.rmSync(folder, { recursive: true });
    });

    it('throws if there is inconsistent numbering', async () => {
      // Omit second migration to create inconsistency
      const [migration1, _, migration3] = migrations;

      // Add inconsistent migration folders and file
      for (const { name, file } of [migration1, migration3]) {
        const migrationPath = path.join(folder, name);

        fs.mkdirSync(migrationPath, { recursive: true });
        fs.writeFileSync(path.join(migrationPath, file.name), file.contents);
      }

      await expect(
        target.test({ migration: '', after: Promise.resolve, folder }),
      ).rejects.toThrow('Migrations numbered inconsistency');
    });
  });
});
