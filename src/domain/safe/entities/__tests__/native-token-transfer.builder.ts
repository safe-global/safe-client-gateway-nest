import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { NativeTokenTransfer } from '@/domain/safe/entities/transfer.entity';

export function nativeTokenTransferBuilder(): IBuilder<NativeTokenTransfer> {
  return new Builder<NativeTokenTransfer>()
    .with('blockNumber', faker.number.int())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal())
    .with('value', faker.string.hexadecimal())
    .with('transferId', faker.string.sample());
}

export function toJson(nativeTokenTransfer: NativeTokenTransfer): unknown {
  return {
    ...nativeTokenTransfer,
    type: 'ETHER_TRANSFER',
    executionDate: nativeTokenTransfer.executionDate.toISOString(),
  };
}
