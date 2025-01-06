import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NativeStakingWithdrawConfirmationView implements Baseline {
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingWithdraw],
  })
  type = DecodedType.KilnNativeStakingWithdraw;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters: Array<DataDecodedParameter> | null;

  @ApiProperty()
  value: string;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty()
  validators: Array<`0x${string}`>;

  constructor(args: {
    method: string;
    parameters: Array<DataDecodedParameter> | null;
    value: string;
    tokenInfo: TokenInfo;
    validators: Array<`0x${string}`>;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.value = args.value;
    this.tokenInfo = args.tokenInfo;
    this.validators = args.validators;
  }
}
