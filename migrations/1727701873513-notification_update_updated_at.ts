import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationUpdateUpdatedAt1727701873513
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TRIGGER update_push_notification_devices_updated_at
                BEFORE UPDATE
                ON
                    push_notification_devices
                FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at();
    `);
    await queryRunner.query(`
            CREATE TRIGGER update_notification_subscriptions_updated_at
                BEFORE UPDATE
                ON
                    notification_subscriptions
                FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_push_notification_devices_updated_at ON push_notification_devices;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_notification_subscriptions_updated_at ON notification_subscriptions;`,
    );
  }
}
