import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWallet1737368483467 implements MigrationInterface {
  name = 'CreateWallet1737368483467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "address" character varying(42) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "UQ_c768f361750f1703d32c1d67599" UNIQUE ("user_id", "address"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f907d5fd09a9d374f1da4e13bd" ON "wallets" ("address") `,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_92558c08091598f7a4439586cda" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_92558c08091598f7a4439586cda"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f907d5fd09a9d374f1da4e13bd"`,
    );
    await queryRunner.query(`DROP TABLE "wallets"`);
  }
}
