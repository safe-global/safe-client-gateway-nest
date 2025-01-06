import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTimestampTrigger1727701600427 implements MigrationInterface {
  name = 'UpdateTimestampTrigger1727701600427';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE  FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at;`);
  }
}
