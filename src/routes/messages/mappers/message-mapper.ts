import { Inject, Injectable } from '@nestjs/common';
import { MessageConfirmation as DomainMessageConfirmation } from '@/domain/messages/entities/message-confirmation.entity';
import { Message as DomainMessage } from '@/domain/messages/entities/message.entity';
import { SafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { MessageConfirmation } from '@/routes/messages/entities/message-confirmation.entity';
import { MessageItem } from '@/routes/messages/entities/message-item.entity';
import {
  MessageStatus,
  Message,
} from '@/routes/messages/entities/message.entity';

@Injectable()
export class MessageMapper {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {}

  async mapMessageItems(
    chainId: string,
    domainMessages: Array<DomainMessage>,
    safe: Safe,
  ): Promise<Array<MessageItem>> {
    return Promise.all(
      domainMessages.map(async (domainMessage) => {
        const message = await this.mapMessage(chainId, domainMessage, safe);
        return new MessageItem(
          message.messageHash,
          message.status,
          message.logoUri,
          message.name,
          message.message,
          message.creationTimestamp,
          message.modifiedTimestamp,
          message.confirmationsSubmitted,
          message.confirmationsRequired,
          message.proposedBy,
          message.confirmations,
          message.preparedSignature,
          message.origin,
        );
      }),
    );
  }

  async mapMessage(
    chainId: string,
    message: DomainMessage,
    safe: Safe,
  ): Promise<Message> {
    const safeApp = message.safeAppId
      ? await this.safeAppsRepository.getSafeAppById(chainId, message.safeAppId)
      : null;
    const status =
      message.confirmations.length >= safe.threshold
        ? MessageStatus.Confirmed
        : MessageStatus.NeedsConfirmation;
    const proposedBy = await this.addressInfoHelper.getOrDefault(
      chainId,
      message.proposedBy,
      ['CONTRACT'],
    );
    const confirmations = await this.mapConfirmations(
      chainId,
      message.confirmations,
    );
    const preparedSignature =
      message.preparedSignature && status === MessageStatus.Confirmed
        ? message.preparedSignature
        : null;

    return new Message(
      message.messageHash,
      status,
      safeApp?.iconUrl ?? null,
      safeApp?.name ?? null,
      message.message,
      message.created.getTime(),
      message.modified.getTime(),
      message.confirmations.length,
      safe.threshold,
      proposedBy,
      confirmations,
      preparedSignature,
      message.origin,
    );
  }

  private async mapConfirmations(
    chainId: string,
    confirmations: Array<DomainMessageConfirmation>,
  ): Promise<Array<MessageConfirmation>> {
    return Promise.all(
      confirmations.map(async (confirmation) => {
        const owner = await this.addressInfoHelper.getOrDefault(
          chainId,
          confirmation.owner,
          ['CONTRACT'],
        );
        return new MessageConfirmation(owner, confirmation.signature);
      }),
    );
  }
}
