import { Inject, Injectable, Module } from '@nestjs/common';
import {
  IMessagesRepository,
  MessagesRepositoryModule,
} from '@/domain/messages/messages.repository.interface';
import {
  ISafeRepository,
  SafeRepositoryModule,
} from '@/domain/safe/safe.repository.interface';
import {
  TransactionEventType,
  ConfigEventType,
} from '@/routes/hooks/entities/event-type.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Event } from '@/routes/hooks/entities/event.entity';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { DeletedMultisigTransactionEvent } from '@/routes/hooks/entities/schemas/deleted-multisig-transaction.schema';
import { ExecutedTransactionEvent } from '@/routes/hooks/entities/schemas/executed-transaction.schema';
import { IncomingEtherEvent } from '@/routes/hooks/entities/schemas/incoming-ether.schema';
import { IncomingTokenEvent } from '@/routes/hooks/entities/schemas/incoming-token.schema';
import { ModuleTransactionEvent } from '@/routes/hooks/entities/schemas/module-transaction.schema';
import { PendingTransactionEvent } from '@/routes/hooks/entities/schemas/pending-transaction.schema';
import { MessageCreatedEvent } from '@/routes/hooks/entities/schemas/message-created.schema';
import {
  IncomingEtherNotification,
  IncomingTokenNotification,
  ConfirmationRequestNotification,
  MessageConfirmationNotification,
  Notification,
  NotificationType,
} from '@/domain/notifications/v2/entities/notification.entity';
import {
  DelegatesV2RepositoryModule,
  IDelegatesV2Repository,
} from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { UUID } from 'crypto';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/v2/notifications.repository.module';

type EventToNotify =
  | DeletedMultisigTransactionEvent
  | ExecutedTransactionEvent
  | IncomingEtherEvent
  | IncomingTokenEvent
  | ModuleTransactionEvent
  | MessageCreatedEvent
  | PendingTransactionEvent;

@Injectable()
export class EventNotificationsHelper {
  constructor(
    @Inject(IDelegatesV2Repository)
    private readonly delegatesRepository: IDelegatesV2Repository,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: IMessagesRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(INotificationsRepositoryV2)
    private readonly notificationsRepository: INotificationsRepositoryV2,
  ) {}

  /**
   * Enqueues notifications for the relevant events to owners/delegates
   * and non-owners/delegates of a Safe accordingly.
   *
   * @param event - {@link Event} to notify about
   */
  public async onEventEnqueueNotifications(event: Event): Promise<unknown> {
    if (!this.isEventToNotify(event)) {
      return;
    }

    const subscriptions = await this.getRelevantSubscribers(event);

    return await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const data = await this.mapEventNotification(
          event,
          subscription.subscriber,
        );

        if (!data) {
          return;
        }

        return this.notificationsRepository
          .enqueueNotification({
            token: subscription.cloudMessagingToken,
            deviceUuid: subscription.deviceUuid,
            notification: {
              data,
            },
          })
          .then(() => {
            this.loggingService.info('Notification sent successfully');
          })
          .catch((e) => {
            this.loggingService.error(
              `Failed to send notification: ${e.reason}`,
            );
          });
      }),
    );
  }

  /**
   * Checks if the event is to be notified.
   *
   * @param event - {@link Event} to check
   */
  private isEventToNotify(event: Event): event is EventToNotify {
    // TODO: Simplify this by inverting the logic and/or refactor mapEventNotification to explicitly handle types
    return (
      // Don't notify about Config events
      event.type !== ConfigEventType.CHAIN_UPDATE &&
      event.type !== ConfigEventType.SAFE_APPS_UPDATE &&
      // We otherwise notify about executed transactions
      event.type !== TransactionEventType.OUTGOING_ETHER &&
      event.type !== TransactionEventType.OUTGOING_TOKEN &&
      // We only notify required confirmations on creation - see PENDING_MULTISIG_TRANSACTION
      event.type !== TransactionEventType.NEW_CONFIRMATION &&
      // We only notify required confirmations on required - see MESSAGE_CREATED
      event.type !== TransactionEventType.MESSAGE_CONFIRMATION &&
      // You cannot subscribe to Safes-to-be-created
      event.type !== TransactionEventType.SAFE_CREATED &&
      // We don't notify about reorgs
      event.type !== TransactionEventType.REORG_DETECTED &&
      // We don't notify about delegate events
      event.type !== TransactionEventType.NEW_DELEGATE &&
      event.type !== TransactionEventType.UPDATED_DELEGATE &&
      event.type !== TransactionEventType.DELETED_DELEGATE
    );
  }

  /**
   * Checks if the event an owner/delegate only event.
   * @param event - {@link EventToNotify} to check
   */
  private isOwnerOrDelegateOnlyEventToNotify(
    event: EventToNotify,
  ): event is PendingTransactionEvent | MessageCreatedEvent {
    // We only notify required confirmation events to owners or delegates
    // to prevent other subscribers from receiving "private" events
    return (
      event.type === TransactionEventType.PENDING_MULTISIG_TRANSACTION ||
      event.type === TransactionEventType.MESSAGE_CREATED
    );
  }

  /**
   * Gets subscribers and their device UUID/cloud messaging tokens for the
   * given Safe depending on the event type.
   *
   * @param event - {@link EventToNotify} to get subscribers for
   *
   * @returns - List of subscribers/tokens for given Safe
   */
  private async getRelevantSubscribers(event: EventToNotify): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  > {
    const subscriptions =
      await this.notificationsRepository.getSubscribersBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      });

    if (!this.isOwnerOrDelegateOnlyEventToNotify(event)) {
      return subscriptions;
    }

    const ownersAndDelegates = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        if (!subscription.subscriber) {
          return;
        }

        const isOwnerOrDelegate = await this.isOwnerOrDelegate({
          chainId: event.chainId,
          safeAddress: event.address,
          subscriber: subscription.subscriber,
        });

        if (!isOwnerOrDelegate) {
          return;
        }

        return subscription;
      }),
    );

    return ownersAndDelegates
      .filter(
        <T>(
          item: PromiseSettledResult<T>,
        ): item is PromiseFulfilledResult<NonNullable<T>> => {
          return item.status === 'fulfilled' && !!item.value;
        },
      )
      .map((result) => result.value);
  }

  /**
   * Checks if the subscriber is an owner or delegate of the Safe.
   *
   * @param args.chainId - Chain ID
   * @param args.safeAddress - Safe address
   * @param args.subscriber - Subscriber address
   *
   * @returns - True if the subscriber is an owner or delegate of the Safe, otherwise false
   */
  private async isOwnerOrDelegate(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    subscriber: `0x${string}`;
  }): Promise<boolean> {
    // We don't use Promise.all avoid unnecessary calls for delegates
    const safe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    if (safe?.owners.includes(args.subscriber)) {
      return true;
    }

    const delegates = await this.delegatesRepository.getDelegates(args);
    return !!delegates?.results.some((delegate) => {
      return (
        delegate.safe === args.safeAddress &&
        delegate.delegate === args.subscriber
      );
    });
  }

  /**
   * Maps an {@link EventToNotify} to a notification.
   *
   * @param event - {@link EventToNotify} to map
   * @param subscriber - Subscriber address
   *
   * @returns - The {@link Notification} if the conditions are met, otherwise null
   */
  private async mapEventNotification(
    event: EventToNotify,
    subscriber: `0x${string}` | null,
  ): Promise<Notification | null> {
    if (
      event.type === TransactionEventType.INCOMING_ETHER ||
      event.type === TransactionEventType.INCOMING_TOKEN
    ) {
      return await this.mapIncomingAssetEventNotification(event);
    } else if (
      event.type === TransactionEventType.PENDING_MULTISIG_TRANSACTION
    ) {
      if (!subscriber) {
        return null;
      }
      return await this.mapPendingMultisigTransactionEventNotification(
        event,
        subscriber,
      );
    } else if (event.type === TransactionEventType.MESSAGE_CREATED) {
      if (!subscriber) {
        return null;
      }
      return await this.mapMessageCreatedEventNotification(event, subscriber);
    } else {
      return event;
    }
  }

  /**
   * Maps {@link IncomingEtherEvent} or {@link IncomingTokenEvent} to {@link IncomingEtherNotification} or {@link IncomingTokenNotification} if:
   *
   * - The asset was sent to the Safe by another address.
   *
   * @param event - {@link IncomingEtherEvent} or {@link IncomingTokenEvent} to map
   *
   * @returns - The {@link IncomingEtherNotification} or {@link IncomingTokenNotification} if the conditions are met, otherwise null
   */
  private async mapIncomingAssetEventNotification(
    event: IncomingEtherEvent | IncomingTokenEvent,
  ): Promise<IncomingEtherNotification | IncomingTokenNotification | null> {
    const incomingTransfers = await this.safeRepository
      .getIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
        txHash: event.txHash,
      })
      .catch(() => null);

    const transfer = incomingTransfers?.results?.find((result) => {
      return result.transactionHash === event.txHash;
    });

    // Asset sent to self - do not notify
    if (transfer?.from === event.address) {
      return null;
    }

    return event;
  }

  /**
   * Maps {@link PendingTransactionEvent} to {@link ConfirmationRequestNotification} if:
   *
   * - The Safe has a threshold > 1.
   * - The subscriber didn't create the transaction.
   *
   * @param event - {@link PendingTransactionEvent} to map
   * @param subscriber - Subscriber address
   *
   * @returns - The {@link ConfirmationRequestNotification} if the conditions are met, otherwise null
   */
  private async mapPendingMultisigTransactionEventNotification(
    event: PendingTransactionEvent,
    subscriber: `0x${string}`,
  ): Promise<ConfirmationRequestNotification | null> {
    const safe = await this.safeRepository.getSafe({
      chainId: event.chainId,
      address: event.address,
    });

    // Transaction is confirmed and awaiting execution - do not notify
    if (safe.threshold === 1) {
      return null;
    }

    const transaction = await this.safeRepository.getMultiSigTransaction({
      chainId: event.chainId,
      safeTransactionHash: event.safeTxHash,
    });

    // Subscriber has already signed - do not notify
    const hasSubscriberSigned = transaction.confirmations?.some(
      (confirmation) => {
        return confirmation.owner === subscriber;
      },
    );
    if (hasSubscriberSigned) {
      return null;
    }

    return {
      type: NotificationType.CONFIRMATION_REQUEST,
      chainId: event.chainId,
      address: event.address,
      safeTxHash: event.safeTxHash,
    };
  }

  /**
   * Maps {@link MessageCreatedEvent} to {@link MessageConfirmationNotification} if:
   *
   * - The Safe has a threshold > 1.
   * - The subscriber didn't create the message.
   *
   * @param event - {@link MessageCreatedEvent} to map
   * @param subscriber - Subscriber address
   *
   * @returns - The {@link MessageConfirmationNotification} if the conditions are met, otherwise null
   */
  private async mapMessageCreatedEventNotification(
    event: MessageCreatedEvent,
    subscriber: `0x${string}`,
  ): Promise<MessageConfirmationNotification | null> {
    const safe = await this.safeRepository.getSafe({
      chainId: event.chainId,
      address: event.address,
    });

    // Message is confirmed - do not notify
    if (safe.threshold === 1) {
      return null;
    }

    const message = await this.messagesRepository.getMessageByHash({
      chainId: event.chainId,
      messageHash: event.messageHash,
    });

    // Subscriber has already signed - do not notify
    const hasSubscriberSigned = message.confirmations.some((confirmation) => {
      return confirmation.owner === subscriber;
    });
    if (hasSubscriberSigned) {
      return null;
    }

    return {
      type: NotificationType.MESSAGE_CONFIRMATION_REQUEST,
      chainId: event.chainId,
      address: event.address,
      messageHash: event.messageHash,
    };
  }
}

@Module({
  imports: [
    DelegatesV2RepositoryModule,
    MessagesRepositoryModule,
    SafeRepositoryModule,
    NotificationsRepositoryV2Module,
  ],
  providers: [EventNotificationsHelper],
  exports: [EventNotificationsHelper],
})
export class EventNotificationsHelperModule {}
