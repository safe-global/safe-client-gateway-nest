import { faker } from '@faker-js/faker';
import {
  assetByProtocolBuilder,
  assetByProtocolChainsBuilder,
  assetByProtocolsBuilder,
  complexProtocolPositionBuilder,
  nestedProtocolPositionBuilder,
  portfolioAssetBuilder,
  portfolioBuilder,
  protocolPositionBuilder,
  regularProtocolPositionBuilder,
} from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { PortfolioMapper } from '@/routes/portfolio/mappers/portfolio.mapper';
import { ProtocolPositionType } from '@/domain/portfolio/entities/portfolio.entity';

describe('PortfolioMapper', () => {
  const target = new PortfolioMapper();
  const chainKeys = Object.entries(PortfolioMapper.ChainKeys) as Array<
    [keyof typeof PortfolioMapper.ChainKeys, string]
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should throw for unknown chains', () => {
    const chainId = '0';
    const portfolio = portfolioBuilder().build();

    expect(() => {
      target.mapChainPortfolio({ chainId, portfolio });
    }).toThrow(`${chainId} is not supported!`);
  });

  it('should map regular positions', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    const protocolType = faker.helpers.arrayElement(
      ProtocolPositionType.filter((type) => type !== 'WALLET'),
    );
    const regularProtocolPosition = regularProtocolPositionBuilder().build();
    const protocolPositions = { [protocolType]: regularProtocolPosition };
    const assetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions,
      })
      .build();
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = {
      [protocol]: assetByProtocol,
    };
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [
        {
          fiatBalance: assetByProtocol.value,
          name: assetByProtocol.name,
          logoUri: assetByProtocol.imgLarge,
          protocolPositions: [
            {
              type: 'REGULAR',
              fiatBalance: regularProtocolPosition.totalValue,
              name: regularProtocolPosition.name,
              assets: regularProtocolPosition.assets.map((asset) => {
                return {
                  type: 'GENERAL',
                  address: asset.contract,
                  decimals: asset.decimal,
                  logoUri: asset.imgSmall,
                  name: asset.name,
                  symbol: asset.symbol,
                  balance: asset.balance,
                  price: asset.price,
                  fiatBalance: asset.value,
                  trusted: false,
                };
              }),
            },
          ],
        },
      ],
      count: 1,
      next: null,
      previous: null,
    });
  });

  it('should map complex positions, with typed assets', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    const protocolType = faker.helpers.arrayElement(
      ProtocolPositionType.filter((type) => type !== 'WALLET'),
    );
    const nestedProtocolPosition = nestedProtocolPositionBuilder().build();
    const complexProtocolPosition = complexProtocolPositionBuilder()
      .with('protocolPositions', [nestedProtocolPosition])
      .build();
    const protocolPositions = { [protocolType]: complexProtocolPosition };
    const assetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions,
      })
      .build();
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = assetByProtocolsBuilder()
      .with(protocol, assetByProtocol)
      .build();
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [
        {
          fiatBalance: assetByProtocol.value,
          name: assetByProtocol.name,
          logoUri: assetByProtocol.imgLarge,
          protocolPositions: [
            {
              type: 'COMPLEX',
              fiatBalance: complexProtocolPosition.totalValue,
              name: complexProtocolPosition.name,
              positions: [
                {
                  fiatBalance: nestedProtocolPosition.value,
                  name: nestedProtocolPosition.name,
                  healthRate: nestedProtocolPosition.healthRate,
                  assets: [
                    ...nestedProtocolPosition.assets.map((asset) => {
                      return {
                        type: 'GENERAL',
                        address: asset.contract,
                        decimals: asset.decimal,
                        logoUri: asset.imgSmall,
                        name: asset.name,
                        symbol: asset.symbol,
                        balance: asset.balance,
                        price: asset.price,
                        fiatBalance: asset.value,
                        trusted: false,
                      };
                    }),
                    ...(nestedProtocolPosition.borrowAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'BORROW',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                    ...(nestedProtocolPosition.dexAssets ?? []).map((asset) => {
                      return {
                        type: 'DEX',
                        address: asset.contract,
                        decimals: asset.decimal,
                        logoUri: asset.imgSmall,
                        name: asset.name,
                        symbol: asset.symbol,
                        balance: asset.balance,
                        price: asset.price,
                        fiatBalance: asset.value,
                        trusted: false,
                      };
                    }),
                    ...(nestedProtocolPosition.rewardAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'REWARDS',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                    ...(nestedProtocolPosition.supplyAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'SUPPLY',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                  ],
                },
              ],
            },
          ],
        },
      ],
      count: 1,
      next: null,
      previous: null,
    });
  });

  it('should map both regular and complex positions', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const regularProtocol = faker.string.sample();
    const complexProtocol = faker.string.sample();
    const protocolType = faker.helpers.arrayElement(
      ProtocolPositionType.filter((type) => type !== 'WALLET'),
    );
    const regularProtocolPosition = regularProtocolPositionBuilder().build();
    const regularProtocolPositions = {
      [protocolType]: regularProtocolPosition,
    };
    const regularAssetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions: regularProtocolPositions,
      })
      .build();
    const regularAssetByProtocol = assetByProtocolBuilder()
      .with('chains', regularAssetByProtocolChains)
      .build();
    const nestedProtocolPosition = nestedProtocolPositionBuilder().build();
    const complexProtocolPosition = complexProtocolPositionBuilder()
      .with('protocolPositions', [nestedProtocolPosition])
      .build();
    const complexProtocolPositions = {
      [protocolType]: complexProtocolPosition,
    };
    const complexAssetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions: complexProtocolPositions,
      })
      .build();
    const complexAssetByProtocol = assetByProtocolBuilder()
      .with('chains', complexAssetByProtocolChains)
      .build();
    const assetByProtocols = {
      [regularProtocol]: regularAssetByProtocol,
      [complexProtocol]: complexAssetByProtocol,
    };
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [
        {
          fiatBalance: regularAssetByProtocol.value,
          name: regularAssetByProtocol.name,
          logoUri: regularAssetByProtocol.imgLarge,
          protocolPositions: [
            {
              type: 'REGULAR',
              name: regularProtocolPosition.name,
              assets: regularProtocolPosition.assets.map((asset) => {
                return {
                  type: 'GENERAL',
                  address: asset.contract,
                  decimals: asset.decimal,
                  logoUri: asset.imgSmall,
                  name: asset.name,
                  symbol: asset.symbol,
                  balance: asset.balance,
                  price: asset.price,
                  fiatBalance: asset.value,
                  trusted: false,
                };
              }),
              fiatBalance: regularProtocolPosition.totalValue,
            },
          ],
        },
        {
          fiatBalance: complexAssetByProtocol.value,
          name: complexAssetByProtocol.name,
          logoUri: complexAssetByProtocol.imgLarge,
          protocolPositions: [
            {
              type: 'COMPLEX',
              fiatBalance: complexProtocolPosition.totalValue,
              name: complexProtocolPosition.name,
              positions: [
                {
                  fiatBalance: nestedProtocolPosition.value,
                  name: nestedProtocolPosition.name,
                  healthRate: nestedProtocolPosition.healthRate,
                  assets: [
                    ...nestedProtocolPosition.assets.map((asset) => {
                      return {
                        type: 'GENERAL',
                        address: asset.contract,
                        decimals: asset.decimal,
                        logoUri: asset.imgSmall,
                        name: asset.name,
                        symbol: asset.symbol,
                        balance: asset.balance,
                        price: asset.price,
                        fiatBalance: asset.value,
                        trusted: false,
                      };
                    }),
                    ...(nestedProtocolPosition.borrowAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'BORROW',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                    ...(nestedProtocolPosition.dexAssets ?? []).map((asset) => {
                      return {
                        type: 'DEX',
                        address: asset.contract,
                        decimals: asset.decimal,
                        logoUri: asset.imgSmall,
                        name: asset.name,
                        symbol: asset.symbol,
                        balance: asset.balance,
                        price: asset.price,
                        fiatBalance: asset.value,
                        trusted: false,
                      };
                    }),
                    ...(nestedProtocolPosition.rewardAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'REWARDS',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                    ...(nestedProtocolPosition.supplyAssets ?? []).map(
                      (asset) => {
                        return {
                          type: 'SUPPLY',
                          address: asset.contract,
                          decimals: asset.decimal,
                          logoUri: asset.imgSmall,
                          name: asset.name,
                          symbol: asset.symbol,
                          balance: asset.balance,
                          price: asset.price,
                          fiatBalance: asset.value,
                          trusted: false,
                        };
                      },
                    ),
                  ],
                },
              ],
            },
          ],
        },
      ],
      count: 2,
      next: null,
      previous: null,
    });
  });

  it('should not include wallet assets in the results', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    // Can be regular, complex or not constrain to a specific type
    const protocolPosition = protocolPositionBuilder().build();
    const protocolPositions = { WALLET: protocolPosition };
    const assetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions,
      })
      .build();
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = { [protocol]: assetByProtocol };
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [],
      count: 0,
      next: null,
      previous: null,
    });
  });

  it('should return no results if no positions are found', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    const assetByProtocolChains = assetByProtocolChainsBuilder().build();
    // No positions on chain
    delete assetByProtocolChains[key];
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = {
      [protocol]: assetByProtocol,
    };
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    const result = target.mapChainPortfolio({
      chainId,
      portfolio,
    });

    expect(result).toEqual({
      results: [],
      count: 0,
      next: null,
      previous: null,
    });
  });

  it('should throw for unknown position types', () => {
    const [key, chainId] = faker.helpers.arrayElement(chainKeys);
    const protocol = faker.string.sample();
    const protocolType = faker.helpers.arrayElement(
      ProtocolPositionType.filter((type) => type !== 'WALLET'),
    );
    const protocolPosition = protocolPositionBuilder()
      // Unknown as both assets and protocolPositions are present
      .with('assets', [portfolioAssetBuilder().build()])
      .with('protocolPositions', [nestedProtocolPositionBuilder().build()])
      .build();
    const protocolPositions = { [protocolType]: protocolPosition };
    const assetByProtocolChains = assetByProtocolChainsBuilder()
      .with(key, {
        protocolPositions,
      })
      .build();
    const assetByProtocol = assetByProtocolBuilder()
      .with('chains', assetByProtocolChains)
      .build();
    const assetByProtocols = { [protocol]: assetByProtocol };
    const portfolio = portfolioBuilder()
      .with('assetByProtocols', assetByProtocols)
      .build();

    expect(() =>
      target.mapChainPortfolio({
        chainId,
        portfolio,
      }),
    ).toThrow(
      `Unknown position. type=${protocolType}, assets=1, protocolPositions=1`,
    );
  });
});
