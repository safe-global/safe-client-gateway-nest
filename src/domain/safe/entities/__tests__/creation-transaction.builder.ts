import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';

export function creationTransactionBuilder(): IBuilder<CreationTransaction> {
  return new Builder<CreationTransaction>()
    .with('created', faker.date.recent())
    .with('creator', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal())
    .with('factoryAddress', faker.finance.ethereumAddress())
    .with('masterCopy', faker.finance.ethereumAddress())
    .with('setupData', faker.string.hexadecimal())
    .with('dataDecoded', dataDecodedBuilder().build());
}

export function toJson(creationTransaction: CreationTransaction): unknown {
  return {
    ...creationTransaction,
    created: creationTransaction.created.toISOString(),
  };
}
