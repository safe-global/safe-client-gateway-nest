import { Builder, IBuilder } from '@/__tests__/builder';
import {
  ZerionCollectible,
  ZerionCollectibleAttributes,
  ZerionCollectibles,
  ZerionCollectionInfo,
  ZerionNFTInfo,
} from '@/datasources/balances-api/entities/zerion-collectible.entity';
import { faker } from '@faker-js/faker';

export function zerionNFTInfoBuilder(): IBuilder<ZerionNFTInfo> {
  return new Builder<ZerionNFTInfo>()
    .with('content', {
      preview: { url: faker.internet.url({ appendSlash: true }) },
      detail: { url: faker.internet.url({ appendSlash: true }) },
    })
    .with('contract_address', faker.finance.ethereumAddress())
    .with('flags', { is_spam: faker.datatype.boolean() })
    .with('interface', faker.string.alphanumeric())
    .with('name', faker.string.alphanumeric())
    .with('token_id', faker.string.numeric());
}

export function zerionCollectionInfoBuilder(): IBuilder<ZerionCollectionInfo> {
  return new Builder<ZerionCollectionInfo>()
    .with('content', {
      icon: { url: faker.internet.url({ appendSlash: true }) },
      banner: { url: faker.internet.url({ appendSlash: true }) },
    })
    .with('description', faker.string.alphanumeric())
    .with('name', faker.string.alphanumeric());
}

export function zerionCollectibleAttributesBuilder(): IBuilder<ZerionCollectibleAttributes> {
  return new Builder<ZerionCollectibleAttributes>()
    .with('amount', faker.string.numeric())
    .with('changed_at', faker.date.recent().toString())
    .with('collection_info', zerionCollectionInfoBuilder().build())
    .with('nft_info', zerionNFTInfoBuilder().build())
    .with('price', faker.number.float())
    .with('value', faker.number.float());
}

export function zerionCollectibleBuilder(): IBuilder<ZerionCollectible> {
  return new Builder<ZerionCollectible>()
    .with('type', 'nft_positions')
    .with('id', faker.string.sample())
    .with('attributes', zerionCollectibleAttributesBuilder().build());
}

export function zerionCollectiblesBuilder(): IBuilder<ZerionCollectibles> {
  return new Builder<ZerionCollectibles>()
    .with(
      'data',
      Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () =>
        zerionCollectibleBuilder().build(),
      ),
    )
    .with('links', {
      self: faker.internet.url({ appendSlash: true }),
      next: `${faker.internet.url({ appendSlash: true })}?page%5Bafter%5D=IjUwIg%3D%3D&page%5Bsize%5D=50`,
    });
}
