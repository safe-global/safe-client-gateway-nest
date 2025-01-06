import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanNotificationData1733761866546 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notification_subscription_notification_types;`,
    );
    await queryRunner.query(`DELETE FROM notification_subscriptions;`);
    await queryRunner.query(`DELETE FROM push_notification_devices;`);
  }

  public async down(): Promise<void> {}
}
