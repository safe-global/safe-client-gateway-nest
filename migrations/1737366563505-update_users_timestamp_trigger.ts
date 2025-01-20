import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUsersTimestampTrigger1737366563505
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                CREATE TRIGGER update_users_updated_at
                    BEFORE UPDATE
                    ON
                        users
                    FOR EACH ROW
                EXECUTE PROCEDURE update_updated_at();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_users_updated_at ON users;`,
    );
  }
}
