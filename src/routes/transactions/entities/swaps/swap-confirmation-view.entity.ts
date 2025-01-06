import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import { OrderInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import {
  OrderClass,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';

export class CowSwapConfirmationView implements Baseline, OrderInfo {
  // Baseline implementation
  @ApiProperty({ enum: [DecodedType.CowSwapOrder] })
  type = DecodedType.CowSwapOrder;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters: Array<DataDecodedParameter> | null;

  // OrderInfo implementation
  @ApiProperty({ description: 'The order UID' })
  uid: string;

  @ApiProperty({
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({ enum: Object.values(OrderKind) })
  kind: OrderKind;

  @ApiProperty({
    enum: OrderClass,
  })
  orderClass: OrderClass;

  @ApiProperty({ description: 'The timestamp when the order expires' })
  validUntil: number;

  @ApiProperty({
    description: 'The sell token raw amount (no decimals)',
  })
  sellAmount: string;

  @ApiProperty({
    description: 'The buy token raw amount (no decimals)',
  })
  buyAmount: string;

  @ApiProperty({
    description: 'The executed sell token raw amount (no decimals)',
  })
  executedSellAmount: string;

  @ApiProperty({
    description: 'The executed buy token raw amount (no decimals)',
  })
  executedBuyAmount: string;

  @ApiProperty({
    type: String,
    description: 'The URL to the explorer page of the order',
  })
  explorerUrl: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The amount of fees paid for this order.',
  })
  executedSurplusFee: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'The (optional) address to receive the proceeds of the trade',
  })
  receiver: string | null;

  @ApiProperty({
    type: String,
  })
  owner: `0x${string}`;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'The App Data for this order',
  })
  fullAppData: Record<string, unknown> | null;

  @ApiProperty({ description: 'The sell token of the order' })
  sellToken: TokenInfo;

  @ApiProperty({ description: 'The buy token of the order' })
  buyToken: TokenInfo;

  constructor(
    args: Baseline & OrderInfo & { sellToken: TokenInfo; buyToken: TokenInfo },
  ) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.uid = args.uid;
    this.status = args.status;
    this.kind = args.kind;
    this.orderClass = args.orderClass;
    this.validUntil = args.validUntil;
    this.sellAmount = args.sellAmount;
    this.buyAmount = args.buyAmount;
    this.executedSellAmount = args.executedSellAmount;
    this.executedBuyAmount = args.executedBuyAmount;
    this.explorerUrl = args.explorerUrl;
    this.executedSurplusFee = args.executedSurplusFee;
    this.sellToken = args.sellToken;
    this.buyToken = args.buyToken;
    this.receiver = args.receiver;
    this.owner = args.owner;
    this.fullAppData = args.fullAppData;
  }
}
