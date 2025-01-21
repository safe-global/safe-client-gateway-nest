import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';

export enum PortfolioAssetType {
  General = 'GENERAL',
  Borrow = 'BORROW',
  Dex = 'DEX',
  Rewards = 'REWARDS',
  Supply = 'SUPPLY',
}

export class PortfolioAsset extends TokenInfo {
  @ApiProperty({ enum: PortfolioAssetType })
  type: PortfolioAssetType;

  @ApiProperty()
  balance: string;

  @ApiProperty()
  price: string;

  @ApiProperty({ description: 'USD' })
  fiatBalance: string;

  constructor(args: {
    type: PortfolioAssetType;
    address: `0x${string}`;
    decimals: number;
    logoUri: string;
    name: string;
    symbol: string;
    balance: string;
    price: string;
    fiatBalance: string;
  }) {
    super({
      address: args.address,
      decimals: args.decimals,
      logoUri: args.logoUri,
      name: args.name,
      symbol: args.symbol,
      // Don't trust external API
      trusted: false,
    });

    this.type = args.type;
    this.balance = args.balance;
    this.price = args.price;
    this.fiatBalance = args.fiatBalance;
  }
}
