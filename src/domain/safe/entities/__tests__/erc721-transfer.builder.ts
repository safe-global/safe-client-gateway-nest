import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { ERC721Transfer } from '@/domain/safe/entities/transfer.entity';

export function erc721TransferBuilder(): IBuilder<ERC721Transfer> {
  return new Builder<ERC721Transfer>()
    .with('blockNumber', faker.number.int())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal())
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('tokenId', faker.string.sample())
    .with('transferId', faker.string.sample());
}

export function toJson(erc721Transfer: ERC721Transfer): unknown {
  return {
    ...erc721Transfer,
    type: 'ERC721_TRANSFER',
    executionDate: erc721Transfer.executionDate.toISOString(),
  };
}
