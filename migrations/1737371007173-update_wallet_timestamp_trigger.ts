import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWalletTimestampTrigger1737371007173
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                    CREATE TRIGGER update_wallets_updated_at
                        BEFORE UPDATE
                        ON
                            wallets
                        FOR EACH ROW
                    EXECUTE PROCEDURE update_updated_at();
            `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;`,
    );
  }
}
