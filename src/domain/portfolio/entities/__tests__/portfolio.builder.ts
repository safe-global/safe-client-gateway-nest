import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import {
  ProtocolChainKeys,
  ProtocolPositionType,
} from '@/domain/portfolio/entities/portfolio.entity';
import type {
  AssetByProtocol,
  Portfolio,
  PortfolioAsset,
  ProtocolPosition,
  ProtocolPositions,
  NestedProtocolPosition,
} from '@/domain/portfolio/entities/portfolio.entity';

export function portfolioBuilder(): IBuilder<Portfolio> {
  return new Builder<Portfolio>().with(
    'assetByProtocols',
    assetByProtocolsBuilder().build(),
  );
}

function assetByProtocolsBuilder(): IBuilder<Portfolio['assetByProtocols']> {
  const builder = new Builder<Portfolio['assetByProtocols']>();
  const protocols = faker.helpers.multiple(() => faker.string.sample(), {
    count: {
      min: 1,
      max: 5,
    },
  });
  for (const protocol of protocols) {
    builder.with(protocol, assetByProtocolBuilder().build());
  }
  return builder;
}

export function assetByProtocolBuilder(): IBuilder<AssetByProtocol> {
  return new Builder<AssetByProtocol>()
    .with('chains', assetByProtocolChainBuilder().build())
    .with('name', faker.string.sample())
    .with('imgLarge', faker.internet.url())
    .with('value', faker.string.numeric());
}

export function assetByProtocolChainBuilder(): IBuilder<
  AssetByProtocol['chains']
> {
  const builder = new Builder<AssetByProtocol['chains']>();
  const keys = faker.helpers.arrayElements(ProtocolChainKeys, {
    min: 1,
    max: 5,
  });
  for (const key of keys) {
    builder.with(key, {
      protocolPositions: protocolPositionsBuilder().build(),
    });
  }
  return builder;
}

export function protocolPositionsBuilder(): IBuilder<ProtocolPositions> {
  const builder = new Builder<ProtocolPositions>();
  const types = faker.helpers.arrayElements(ProtocolPositionType, {
    min: 1,
    max: 5,
  });
  for (const type of types) {
    builder.with(type, protocolPositionBuilder().build());
  }
  return builder;
}

function getPortfolioAssets(): Array<PortfolioAsset> {
  return faker.helpers.multiple(() => portfolioAssetBuilder().build(), {
    count: {
      min: 1,
      max: 5,
    },
  });
}

export function protocolPositionBuilder(): IBuilder<ProtocolPosition> {
  return faker.datatype.boolean()
    ? regularProtocolPositionBuilder()
    : complexProtocolPositionBuilder();
}

function regularProtocolPositionBuilder(): IBuilder<ProtocolPosition> {
  return (
    new Builder<ProtocolPosition>()
      .with('name', faker.string.sample())
      // Regular as it only has assets
      .with('assets', getPortfolioAssets())
      .with('protocolPositions', [])
      .with('totalValue', faker.string.numeric())
  );
}

function complexProtocolPositionBuilder(): IBuilder<ProtocolPosition> {
  return (
    new Builder<ProtocolPosition>()
      .with('name', faker.string.sample())
      // Complex as it only has protocolPositions
      .with('assets', [])
      .with(
        'protocolPositions',
        faker.helpers.multiple(() => nestedProtocolPositionBuilder().build(), {
          count: {
            min: 1,
            max: 5,
          },
        }),
      )
      .with('totalValue', faker.string.numeric())
  );
}

export function nestedProtocolPositionBuilder(): IBuilder<NestedProtocolPosition> {
  function getOptionalPortfolioAssets(): Array<PortfolioAsset> | undefined {
    return faker.datatype.boolean() ? getPortfolioAssets() : undefined;
  }

  return new Builder<NestedProtocolPosition>()
    .with('name', faker.string.sample())
    .with('value', faker.string.numeric())
    .with(
      'assets',
      faker.helpers.multiple(() => portfolioAssetBuilder().build(), {
        count: {
          min: 1,
          max: 5,
        },
      }),
    )
    .with('borrowAssets', getOptionalPortfolioAssets())
    .with('dexAssets', getOptionalPortfolioAssets())
    .with('rewardAssets', getOptionalPortfolioAssets())
    .with('supplyAssets', getOptionalPortfolioAssets());
}

export function portfolioAssetBuilder(): IBuilder<PortfolioAsset> {
  return new Builder<PortfolioAsset>()
    .with('balance', faker.string.numeric())
    .with('decimal', faker.number.int({ min: 1, max: 18 }))
    .with('name', faker.string.sample())
    .with('price', faker.string.numeric())
    .with('symbol', faker.string.sample())
    .with('value', faker.string.numeric())
    .with('contract', getAddress(faker.finance.ethereumAddress()))
    .with('imgSmall', faker.internet.url());
}
