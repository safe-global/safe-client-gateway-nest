import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { ERC20Transfer } from '@/domain/safe/entities/transfer.entity';

export function erc20TransferBuilder(): IBuilder<ERC20Transfer> {
  return new Builder<ERC20Transfer>()
    .with('blockNumber', faker.number.int())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal())
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('value', faker.string.hexadecimal())
    .with('transferId', faker.string.sample());
}

export function toJson(erc20Transfer: ERC20Transfer): unknown {
  return {
    ...erc20Transfer,
    type: 'ERC20_TRANSFER',
    executionDate: erc20Transfer.executionDate.toISOString(),
  };
}
