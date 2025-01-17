import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1737105288458 implements MigrationInterface {
  name = 'CreateUsers1737105288458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('1', '2')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "status" "public"."user_status" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
  }
}
