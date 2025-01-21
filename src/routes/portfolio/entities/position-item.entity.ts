import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { PortfolioAsset } from '@/routes/portfolio/entities/portfolio-asset.entity';

type BasePosition = {
  name: string;
  fiatBalance: string;
};

type Position = BasePosition & {
  assets: Array<PortfolioAsset>;
};

enum PositionType {
  Regular = 'REGULAR',
  Complex = 'COMPLEX',
}

export class RegularProtocolPosition implements Position {
  @ApiProperty({ enum: [PositionType.Regular] })
  type = PositionType.Regular;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: PortfolioAsset, isArray: true })
  assets: Array<PortfolioAsset>;

  @ApiProperty()
  fiatBalance: string;

  constructor(args: {
    name: string;
    assets: Array<PortfolioAsset>;
    fiatBalance: string;
  }) {
    this.name = args.name;
    this.assets = args.assets;
    this.fiatBalance = args.fiatBalance;
  }
}

export class NestedProtocolPosition implements Position {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: PortfolioAsset, isArray: true })
  assets: Array<PortfolioAsset>;

  @ApiProperty()
  fiatBalance: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  healthRate?: string;

  constructor(args: {
    name: string;
    fiatBalance: string;
    healthRate?: string;
    assets: Array<PortfolioAsset>;
  }) {
    this.name = args.name;
    this.assets = args.assets;
    this.fiatBalance = args.fiatBalance;
    this.healthRate = args.healthRate;
  }
}

export class ComplexProtocolPosition implements BasePosition {
  @ApiProperty({ enum: [PositionType.Complex] })
  type = PositionType.Complex;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: NestedProtocolPosition, isArray: true })
  positions: Array<NestedProtocolPosition>;

  @ApiProperty()
  fiatBalance: string;

  constructor(args: {
    name: string;
    positions: Array<NestedProtocolPosition>;
    fiatBalance: string;
  }) {
    this.name = args.name;
    this.positions = args.positions;
    this.fiatBalance = args.fiatBalance;
  }
}

export class PositionItem implements BasePosition {
  @ApiProperty()
  fiatBalance: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  logoUri: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(RegularProtocolPosition) },
      { $ref: getSchemaPath(ComplexProtocolPosition) },
    ],
    isArray: true,
  })
  protocolPositions: Array<RegularProtocolPosition | ComplexProtocolPosition>;

  constructor(args: {
    fiatBalance: string;
    name: string;
    logoUri: string;
    protocolPositions: Array<RegularProtocolPosition | ComplexProtocolPosition>;
  }) {
    this.fiatBalance = args.fiatBalance;
    this.name = args.name;
    this.logoUri = args.logoUri;
    this.protocolPositions = args.protocolPositions;
  }
}
