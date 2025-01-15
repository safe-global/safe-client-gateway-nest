import { Injectable } from '@nestjs/common';
import {
  ComplexPosition as DomainComplexPosition,
  Portfolio as DomainPortfolio,
  PortfolioAsset as DomainPortfolioAsset,
  ProtocolChainKeys as DomainPortfolioChainKeys,
  RegularPosition as DomainRegularPosition,
} from '@/domain/portfolio/entities/portfolio.entity';
import { PortfolioItemPage } from '@/routes/portfolio/entities/portfolio-item-page.entity';
import {
  ComplexPosition,
  ComplexPositionPosition,
  PositionItem,
  RegularPosition,
} from '@/routes/portfolio/entities/positions';
import {
  PortfolioAsset,
  PortfolioAssetType,
} from '@/routes/portfolio/entities/portfolio-asset.entity';

@Injectable()
export class PortfolioMapper {
  // TODO: Move these to the Config Service
  public static ChainKeys: {
    [key in (typeof DomainPortfolioChainKeys)[number]]: string;
  } = {
    ancient8: '888888888',
    arbitrum: '42161',
    arbitrum_nova: '42170',
    aurora: '1313161554',
    avalanche: '43114',
    base: '8453',
    binance: '56',
    blast: '81457',
    bob: '60808',
    boba: '288',
    celo: '42220',
    core: '1116',
    cronos: '25',
    era: '324',
    ethereum: '1',
    fantom: '250',
    fraxtal: '252',
    gnosis: '100',
    hyperliquid: '998',
    kava: '2222',
    kroma: '255',
    linea: '59144',
    manta: '169',
    mantle: '5000',
    metis: '1088',
    mint: '185',
    mode: '34443',
    optimism: '10',
    polygon: '137',
    polygon_zkevm: '1101',
    rari: '1380012617',
    scroll: '534352',
    solana: '101',
    taiko: '167000',
    wc: '480',
    xlayer: '196',
    zora: '7777777',
  };

  /**
   * The {@link DomainPortfolio} entity contains a list of assets by protocol
   * for all chains, with no clear distinction between properties. This simplifies
   * the former, mapping the desired chain to the {@link PortfolioItemPage} entity.
   *
   * @param args.chainId - chain ID to "extract"
   * @param args.portfolio - {@link DomainPortfolio} to map
   *
   * @returns {@link Portfolio} entity
   */
  public mapChainPortfolio(args: {
    chainId: string;
    portfolio: DomainPortfolio;
  }): PortfolioItemPage {
    const key = this.getChainKey(args.chainId);

    const results: Array<PositionItem> = [];

    for (const assetByProtocol of Object.values(
      args.portfolio.assetByProtocols,
    )) {
      const assetByProtocolOnChain = assetByProtocol.chains[key];

      if (!assetByProtocolOnChain) {
        continue;
      }

      const protocolPositions = Object.values(
        assetByProtocolOnChain.protocolPositions,
      ).map((protocolPosition) => {
        if (!this.isComplexPosition(protocolPosition)) {
          return this.mapRegularPosition(protocolPosition);
        }
        return this.mapComplexPosition(protocolPosition);
      });

      results.push(
        new PositionItem({
          value: assetByProtocol.value,
          name: assetByProtocol.name,
          logoUri: assetByProtocol.imgLarge,
          protocolPositions,
        }),
      );
    }

    return new PortfolioItemPage({
      results,
      count: results.length,
      // Octav doesn't paginate the results
      next: null,
      previous: null,
    });
  }

  /**
   * Get the chain key from the {@link PortfolioMapper.ChainKeys} object according
   * to the given chain ID. (The current API returns data based on chain keys.)
   *
   * @param chainId - chain ID
   * @returns key of the {@link PortfolioMapper.ChainKeys} object
   */
  private getChainKey(chainId: string): keyof typeof PortfolioMapper.ChainKeys {
    const chain = Object.entries(PortfolioMapper.ChainKeys).find(
      ([, keyChainId]) => {
        return chainId === keyChainId;
      },
    );

    if (!chain) {
      throw new Error(`${chainId} is not supported!`);
    }
    return chain[0] as keyof typeof PortfolioMapper.ChainKeys;
  }

  /**
   * Checks if protocol position is complex: whether it has nested positions
   *
   * @param position - {@link DomainRegularPosition} or {@link DomainComplexPosition} to check
   *
   * @returns true if the position is complex, otherwise false
   */
  private isComplexPosition(
    position: DomainRegularPosition | DomainComplexPosition,
  ): position is DomainComplexPosition {
    return 'protocolPositions' in position;
  }

  private mapRegularPosition(position: DomainRegularPosition): RegularPosition {
    const assets = position.assets.map((asset) => {
      return this.mapPositionAsset({
        type: PortfolioAssetType.General,
        asset,
      });
    });
    return new RegularPosition({
      name: position.name,
      assets,
      value: position.totalValue,
    });
  }

  private mapComplexPosition(position: DomainComplexPosition): ComplexPosition {
    return new ComplexPosition({
      name: position.name,
      positions: position.protocolPositions.map(
        this.mapComplexPositionProtocolPosition,
      ),
    });
  }

  private mapComplexPositionProtocolPosition(
    position: DomainComplexPosition['protocolPositions'][number],
  ): ComplexPositionPosition {
    const assetTypes: {
      [key in PortfolioAssetType]: Array<DomainPortfolioAsset>;
    } = {
      [PortfolioAssetType.General]: position.assets,
      [PortfolioAssetType.Borrow]: position.borrowAssets ?? [],
      [PortfolioAssetType.Dex]: position.dexAssets ?? [],
      [PortfolioAssetType.Rewards]: position.rewardAssets ?? [],
      [PortfolioAssetType.Supply]: position.supplyAssets ?? [],
    };

    // Merge all different assets into a type-discriminated array
    const assets = Object.entries(assetTypes).flatMap(([type, assets]) => {
      return assets.map((asset) => {
        return this.mapPositionAsset({
          type: type as keyof typeof assetTypes,
          asset,
        });
      });
    });

    return new ComplexPositionPosition({
      name: position.name,
      value: position.value,
      healthRate: position.healthRate,
      assets,
    });
  }

  private mapPositionAsset(args: {
    type: PortfolioAssetType;
    asset: DomainPortfolioAsset;
  }): PortfolioAsset {
    return new PortfolioAsset({
      type: args.type,
      address: args.asset.contract,
      decimals: args.asset.decimal,
      logoUri: args.asset.imgSmall,
      name: args.asset.name,
      symbol: args.asset.symbol,
      balance: args.asset.balance,
      price: args.asset.price,
      fiatBalance: args.asset.value,
    });
  }
}