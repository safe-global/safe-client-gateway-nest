import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationCleanup1726452966034 implements MigrationInterface {
  name = 'NotificationCleanup1726452966034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "update_push_notification_devices_updated_at" ON "push_notification_devices"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "update_notification_subscriptions_updated_at" ON "notification_subscriptions"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "notification_types_name_enum" CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "push_notification_devices_device_type_enum" CASCADE`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at()`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "push_notification_devices" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notification_subscriptions" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notification_subscription_notification_types" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notification_types" CASCADE`,
    );
  }

  public async down(): Promise<void> {}
}
