import { Module } from '@nestjs/common';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';

const MockedNotificationsServiceV2 = {
  upsertSubscriptions: jest.fn(),
  getSafeSubscription: jest.fn(),
  deleteSubscription: jest.fn(),
  deleteDevice: jest.fn(),
} as jest.MockedObjectDeep<NotificationsServiceV2>;

@Module({
  providers: [
    {
      provide: NotificationsServiceV2,
      useFactory: (): jest.MockedObjectDeep<NotificationsServiceV2> => {
        return jest.mocked(MockedNotificationsServiceV2);
      },
    },
  ],
  exports: [NotificationsServiceV2],
})
export class TestNotificationsModuleV2 {}
