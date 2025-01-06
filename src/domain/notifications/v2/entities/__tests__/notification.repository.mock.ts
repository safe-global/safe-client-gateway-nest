import type { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';

export const MockNotificationRepositoryV2: jest.MockedObjectDeep<INotificationsRepositoryV2> =
  {
    enqueueNotification: jest.fn(),
    upsertSubscriptions: jest.fn(),
    getSafeSubscription: jest.fn(),
    getSubscribersBySafe: jest.fn(),
    deleteSubscription: jest.fn(),
    deleteDevice: jest.fn(),
  };
