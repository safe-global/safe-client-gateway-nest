import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import {
  MessageConfirmation,
  SignatureType,
} from '@/domain/messages/entities/message-confirmation.entity';

export function messageConfirmationBuilder(): IBuilder<MessageConfirmation> {
  return new Builder<MessageConfirmation>()
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('owner', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('signatureType', faker.helpers.objectValue(SignatureType));
}

export function toJson(confirmation: MessageConfirmation): unknown {
  return {
    ...confirmation,
    created: confirmation.created.toISOString(),
    modified: confirmation.modified.toISOString(),
  };
}
