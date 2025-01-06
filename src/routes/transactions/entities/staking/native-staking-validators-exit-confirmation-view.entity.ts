import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NativeStakingValidatorsExitConfirmationView implements Baseline {
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingValidatorsExit],
  })
  type = DecodedType.KilnNativeStakingValidatorsExit;

  @ApiProperty({
    enum: StakingStatus,
  })
  status: StakingStatus;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters: Array<DataDecodedParameter> | null;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  value: string;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  @ApiProperty()
  validators: Array<`0x${string}`>;

  constructor(args: {
    method: string;
    parameters: Array<DataDecodedParameter> | null;
    status: StakingStatus;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    value: string;
    numValidators: number;
    tokenInfo: TokenInfo;
    validators: Array<`0x${string}`>;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.status = args.status;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.value = args.value;
    this.numValidators = args.numValidators;
    this.tokenInfo = args.tokenInfo;
    this.validators = args.validators;
  }
}
