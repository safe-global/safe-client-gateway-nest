import { Inject, Injectable } from '@nestjs/common';
import fs from 'node:fs';
import { join } from 'node:path';
import type { Sql, TransactionSql } from 'postgres';

type Migration = {
  path: string;
  id: number;
  name: string;
};

type TestResult<BeforeType, AfterType> = {
  before: BeforeType | undefined;
  after: AfterType;
};

/**
 * Migrates a Postgres database using SQL and JavaScript files.
 *
 * Migrations should be in a directory, prefixed with a 5-digit number,
 * and contain either an `index.sql` or `index.js` file.
 *
 * This is heavily inspired by `postgres-shift`
 * @see https://github.com/porsager/postgres-shift/blob/master/index.js
 */
@Injectable()
export class PostgresDatabaseMigrator {
  private static readonly MIGRATIONS_FOLDER = join(
    process.cwd(),
    'migrations/deprecated',
  );
  private static readonly SQL_MIGRATION_FILE = 'index.sql';
  private static readonly JS_MIGRATION_FILE = 'index.js';
  private static readonly MIGRATIONS_TABLE = 'migrations';

  constructor(@Inject('DB_INSTANCE') private readonly sql: Sql) {}

  /**
   * Runs/records migrations not present in the {@link PostgresDatabaseMigrator.MIGRATIONS_TABLE} table.
   *
   * Note: all migrations are run in a single transaction for optimal performance.
   */
  async migrate(
    path = PostgresDatabaseMigrator.MIGRATIONS_FOLDER,
  ): Promise<Array<Migration>> {
    const migrations = this.getMigrations(path);

    await this.assertMigrationsTable();

    const last = await this.getLastRunMigration();
    const remaining = migrations.slice(last?.id ?? 0);

    await this.sql.begin(async (transaction: TransactionSql) => {
      for (const current of remaining) {
        await this.run({ transaction, migration: current });
        await this.setLastRunMigration({ transaction, migration: current });
      }
    });

    return remaining;
  }

  /**
   * Migrates up to/allows for querying before/after migration to test it.
   * Uses generics to allow the caller to specify the return type of the before/after functions.
   *
   * Note: each migration is ran in separate transaction to allow queries in between.
   *
   * @param args.migration - migration to test
   * @param args.folder - folder to search for migrations
   * @param args.before - function to run before each migration
   * @param args.after - function to run after each migration
   *
   * @example
   * ```typescript
   * const result = await migrator.test({
   *   migration: '00001_initial',
   *   before: (sql) => sql`SELECT * FROM <table_name>`,
   *   after: (sql) => sql`SELECT * FROM <table_name>`,
   * });
   *
   * expect(result.before).toBeUndefined();
   * expect(result.after).toStrictEqual(expected);
   * ```
   */
  async test<BeforeType, AfterType>(args: {
    migration: string;
    before?: (sql: Sql) => Promise<BeforeType>;
    after: (sql: Sql) => Promise<AfterType>;
    folder?: string;
  }): Promise<TestResult<BeforeType, AfterType>> {
    const migrations = this.getMigrations(
      args.folder ?? PostgresDatabaseMigrator.MIGRATIONS_FOLDER,
    );

    // Find index of migration to test
    const migrationIndex = migrations.findIndex((migration) => {
      return migration.path.includes(args.migration);
    });

    if (migrationIndex === -1) {
      throw new Error(`Migration ${args.migration} not found`);
    }

    // Get migrations up to the specified migration
    const migrationsToTest = migrations.slice(0, migrationIndex + 1);

    let before: BeforeType | undefined;

    for (const migration of migrationsToTest) {
      const isMigrationBeingTested = migration.path.includes(args.migration);

      if (isMigrationBeingTested && args.before) {
        before = await args.before(this.sql).catch((err) => {
          throw Error(`Error running before function: ${err}`);
        });
      }

      await this.sql.begin((transaction) => {
        return this.run({ transaction, migration });
      });
    }

    const after = await args.after(this.sql).catch((err) => {
      throw Error(`Error running after function: ${err}`);
    });

    return { before, after };
  }

  /**
   * Retrieves all migrations found at the specified path.
   *
   * @param path - path to search for migrations
   *
   * @returns array of {@link Migration}
   */
  private getMigrations(path: string): Array<Migration> {
    const migrations = fs
      .readdirSync(path)
      .filter((file) => {
        const isDirectory = fs.statSync(join(path, file)).isDirectory();
        const isMigration = file.match(/^[0-9]{5}_/);
        return isDirectory && isMigration;
      })
      .sort()
      .map((file) => {
        return {
          path: join(path, file),
          id: parseInt(file.slice(0, 5)),
          name: file.slice(6),
        };
      });

    if (migrations.length === 0) {
      throw new Error('No migrations found');
    }

    const latest = migrations.at(-1);
    if (latest?.id !== migrations.length) {
      throw new Error('Migrations numbered inconsistency');
    }

    return migrations;
  }

  /**
   * Adds specified migration to the transaction if supported.
   *
   * @param args.transaction - {@link TransactionSql} to migration within
   * @param args.migration - {@link Migration} to add
   */
  private async run(args: {
    transaction: TransactionSql;
    migration: Migration;
  }): Promise<void> {
    const isSql = fs.existsSync(
      join(args.migration.path, PostgresDatabaseMigrator.SQL_MIGRATION_FILE),
    );
    const isJs = fs.existsSync(
      join(args.migration.path, PostgresDatabaseMigrator.JS_MIGRATION_FILE),
    );

    if (isSql) {
      await args.transaction.file(
        join(args.migration.path, PostgresDatabaseMigrator.SQL_MIGRATION_FILE),
      );
    } else if (isJs) {
      const file = (await import(
        join(args.migration.path, PostgresDatabaseMigrator.JS_MIGRATION_FILE)
      )) as {
        default: (transaction: TransactionSql) => Promise<void>;
      };
      await file.default(args.transaction);
    } else {
      throw new Error(`No migration file found for ${args.migration.path}`);
    }
  }
  /**
   * Creates the {@link PostgresDatabaseMigrator.MIGRATIONS_TABLE} table if it does not exist.
   */
  private async assertMigrationsTable(): Promise<void> {
    try {
      await this.sql`SELECT
                        '${this.sql(PostgresDatabaseMigrator.MIGRATIONS_TABLE)}'::regclass`;
    } catch {
      await this.sql`CREATE TABLE
                        ${this.sql(PostgresDatabaseMigrator.MIGRATIONS_TABLE)} (
                            id SERIAL PRIMARY KEY,
                            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                            name TEXT
                        )`;
    }
  }

  /**
   * Retrieves the last run migration from the {@link PostgresDatabaseMigrator.MIGRATIONS_TABLE} table.
   *
   * @returns last run {@link Migration}
   */
  private async getLastRunMigration(): Promise<Migration> {
    const [last] = await this.sql<Array<Migration>>`SELECT
                                                        id
                                                    FROM
                                                        ${this.sql(PostgresDatabaseMigrator.MIGRATIONS_TABLE)}
                                                    ORDER BY
                                                        id DESC
                                                    LIMIT
                                                        1`;

    return last;
  }

  /**
   * Adds the last run migration to the {@link PostgresDatabaseMigrator.MIGRATIONS_TABLE} table.
   *
   * @param args.transaction - {@link TransactionSql} to set within
   * @param args.migration - {@link Migration} to set
   */
  private async setLastRunMigration(args: {
    transaction: TransactionSql;
    migration: Migration;
  }): Promise<void> {
    await args.transaction`INSERT INTO ${this.sql(PostgresDatabaseMigrator.MIGRATIONS_TABLE)} (
                               id,
                               name
                           ) VALUES (
                               ${args.migration.id},
                               ${args.migration.name}
                           )`;
  }
}
