import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Confirmation } from '@/domain/safe/entities/multisig-transaction.entity';

export function confirmationBuilder(): IBuilder<Confirmation> {
  return new Builder<Confirmation>()
    .with('owner', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal())
    .with('signatureType', faker.string.sample())
    .with('submissionDate', faker.date.recent())
    .with('transactionHash', faker.string.hexadecimal());
}

export function toJson(confirmation: Confirmation): unknown {
  return {
    ...confirmation,
    submissionDate: confirmation.submissionDate.toISOString(),
  };
}
