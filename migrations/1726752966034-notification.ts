import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Notification1726752966034 implements MigrationInterface {
  name = 'Notification1726752966034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_notification_devices" ("id" SERIAL NOT NULL, "device_type" character varying(255) NOT NULL, "device_uuid" uuid NOT NULL, "cloud_messaging_token" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "device_uuid" UNIQUE ("device_uuid"), CONSTRAINT "PK_e387f5cc5b4f66d63804d596c64" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_subscriptions" ("id" SERIAL NOT NULL, "chain_id" character varying(255) NOT NULL, "safe_address" character varying(42) NOT NULL, "signer_address" character varying(42), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "push_notification_device_id" integer, CONSTRAINT "UQ_3c2531929422835e4f2717ec5db" UNIQUE ("chain_id", "safe_address", "push_notification_device_id", "signer_address"), CONSTRAINT "PK_8cfec5d2a549ff20d1f4e648226" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_subscription_notification_types" ("id" SERIAL NOT NULL, "notification_subscription_id" integer, "notification_type_id" integer, CONSTRAINT "UQ_5e7563e15aa2f994bd7b07ecec8" UNIQUE ("notification_subscription_id", "notification_type_id"), CONSTRAINT "PK_3754c1a419741973072e5ed92eb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_types" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, CONSTRAINT "name" UNIQUE ("name"), CONSTRAINT "PK_aa965e094494e2c4c5942cfb42d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "FK_9f59e655926203074b833d6f909" FOREIGN KEY ("push_notification_device_id") REFERENCES "push_notification_devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_subscription_notification_types" ADD CONSTRAINT "FK_44702b7d6132421d2049ed994de" FOREIGN KEY ("notification_subscription_id") REFERENCES "notification_subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_subscription_notification_types" ADD CONSTRAINT "FK_3e3e49a32dc1862742a322a6149" FOREIGN KEY ("notification_type_id") REFERENCES "notification_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_subscription_notification_types" DROP CONSTRAINT "FK_3e3e49a32dc1862742a322a6149"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_subscription_notification_types" DROP CONSTRAINT "FK_44702b7d6132421d2049ed994de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_subscriptions" DROP CONSTRAINT "FK_9f59e655926203074b833d6f909"`,
    );
    await queryRunner.query(`DROP TABLE "notification_types"`);
    await queryRunner.query(
      `DROP TABLE "notification_subscription_notification_types"`,
    );
    await queryRunner.query(`DROP TABLE "notification_subscriptions"`);
    await queryRunner.query(`DROP TABLE "push_notification_devices"`);
  }
}
