import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  OrderClass,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  DurationOfPart,
  StartTime,
  TwapOrderInfo,
} from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';

export class CowSwapTwapConfirmationView implements Baseline, TwapOrderInfo {
  // Baseline implementation
  @ApiProperty({ enum: [DecodedType.CowSwapTwapOrder] })
  type = DecodedType.CowSwapTwapOrder;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters: Array<DataDecodedParameter> | null;

  // TwapOrderInfo implementation
  @ApiProperty({
    enum: OrderStatus,
    description: 'The TWAP status',
  })
  status: OrderStatus;

  @ApiProperty({ enum: OrderKind })
  kind: OrderKind.Sell;

  @ApiProperty({ enum: OrderClass })
  class: OrderClass.Limit;

  @ApiProperty({
    description:
      'The order UID of the active order, null as it is not an active order',
    // Prevent bidirectional dependency
    type: 'null',
  })
  activeOrderUid: null;

  @ApiProperty({ description: 'The timestamp when the TWAP expires' })
  validUntil: number;

  @ApiProperty({
    description: 'The sell token raw amount (no decimals)',
  })
  sellAmount: string;

  @ApiProperty({
    description: 'The buy token raw amount (no decimals)',
  })
  buyAmount: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'The executed sell token raw amount (no decimals), or null if there are too many parts',
  })
  executedSellAmount: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'The executed surplus fee raw amount (no decimals), or null if there are too many parts',
  })
  executedSurplusFee: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'The executed buy token raw amount (no decimals), or null if there are too many parts',
  })
  executedBuyAmount: string | null;

  @ApiProperty({ description: 'The sell token of the TWAP' })
  sellToken: TokenInfo;

  @ApiProperty({ description: 'The buy token of the TWAP' })
  buyToken: TokenInfo;

  @ApiProperty({
    description: 'The address to receive the proceeds of the trade',
  })
  receiver: `0x${string}`;

  @ApiProperty({
    type: String,
  })
  owner: `0x${string}`;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'The App Data for this TWAP',
  })
  fullAppData: Record<string, unknown> | null;

  @ApiProperty({
    description: 'The number of parts in the TWAP',
  })
  numberOfParts: string;

  @ApiProperty({
    description: 'The amount of sellToken to sell in each part',
  })
  partSellAmount: string;

  @ApiProperty({
    description: 'The amount of buyToken that must be bought in each part',
  })
  minPartLimit: string;

  @ApiProperty({
    description: 'The duration of the TWAP interval',
  })
  timeBetweenParts: number;

  @ApiProperty({
    description: 'Whether the TWAP is valid for the entire interval or not',
  })
  durationOfPart: DurationOfPart;

  @ApiProperty({
    description: 'The start time of the TWAP',
  })
  startTime: StartTime;

  constructor(args: {
    method: string;
    parameters: Array<DataDecodedParameter> | null;
    status: OrderStatus;
    kind: OrderKind.Sell;
    class: OrderClass.Limit;
    activeOrderUid: null;
    validUntil: number;
    sellAmount: string;
    buyAmount: string;
    executedSellAmount: string | null;
    executedBuyAmount: string | null;
    executedSurplusFee: string | null;
    sellToken: TokenInfo;
    buyToken: TokenInfo;
    receiver: `0x${string}`;
    owner: `0x${string}`;
    fullAppData: Record<string, unknown> | null;
    numberOfParts: string;
    partSellAmount: string;
    minPartLimit: string;
    timeBetweenParts: number;
    durationOfPart: DurationOfPart;
    startTime: StartTime;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.status = args.status;
    this.kind = args.kind;
    this.class = args.class;
    this.activeOrderUid = args.activeOrderUid;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.executedSurplusFee = args.executedSurplusFee;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
    this.numberOfParts = args.numberOfParts;
    this.partSellAmount = args.partSellAmount;
    this.minPartLimit = args.minPartLimit;
    this.timeBetweenParts = args.timeBetweenParts;
    this.durationOfPart = args.durationOfPart;
    this.startTime = args.startTime;
  }
}
