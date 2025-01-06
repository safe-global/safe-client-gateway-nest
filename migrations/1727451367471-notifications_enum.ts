import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsEnum1727451367471 implements MigrationInterface {
  name = 'NotificationsEnum1727451367471';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_types" DROP CONSTRAINT "name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" DROP COLUMN "name"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_types_name_enum" AS ENUM('CONFIRMATION_REQUEST', 'DELETED_MULTISIG_TRANSACTION', 'EXECUTED_MULTISIG_TRANSACTION', 'INCOMING_ETHER', 'INCOMING_TOKEN', 'MODULE_TRANSACTION', 'MESSAGE_CONFIRMATION_REQUEST')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" ADD "name" "public"."notification_types_name_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" ADD CONSTRAINT "UQ_1d7eaa0dcf0fbfd0a8e6bdbc9c9" UNIQUE ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_notification_devices" DROP COLUMN "device_type"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."push_notification_devices_device_type_enum" AS ENUM('ANDROID', 'IOS', 'WEB')`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_notification_devices" ADD "device_type" "public"."push_notification_devices_device_type_enum" NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_notification_devices" DROP COLUMN "device_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."push_notification_devices_device_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_notification_devices" ADD "device_type" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" DROP CONSTRAINT "UQ_1d7eaa0dcf0fbfd0a8e6bdbc9c9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" DROP COLUMN "name"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."notification_types_name_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" ADD "name" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_types" ADD CONSTRAINT "name" UNIQUE ("name")`,
    );
  }
}
