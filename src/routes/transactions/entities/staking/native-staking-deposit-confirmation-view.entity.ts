import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import {
  Baseline,
  DecodedType,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { NativeStakingDepositInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NativeStakingDepositConfirmationView
  implements Baseline, NativeStakingDepositInfo
{
  @ApiProperty({
    enum: [DecodedType.KilnNativeStakingDeposit],
  })
  type = DecodedType.KilnNativeStakingDeposit;

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
  estimatedEntryTime: number;

  @ApiProperty()
  estimatedExitTime: number;

  @ApiProperty()
  estimatedWithdrawalTime: number;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  monthlyNrr: number;

  @ApiProperty()
  annualNrr: number;

  @ApiProperty()
  value: string;

  @ApiProperty()
  numValidators: number;

  @ApiProperty()
  expectedAnnualReward: string;

  @ApiProperty()
  expectedMonthlyReward: string;

  @ApiProperty()
  expectedFiatAnnualReward: number;

  @ApiProperty()
  expectedFiatMonthlyReward: number;

  @ApiProperty()
  tokenInfo: TokenInfo;

  constructor(args: {
    method: string;
    parameters: Array<DataDecodedParameter> | null;
    status: StakingStatus;
    estimatedEntryTime: number;
    estimatedExitTime: number;
    estimatedWithdrawalTime: number;
    fee: number;
    monthlyNrr: number;
    annualNrr: number;
    value: string;
    numValidators: number;
    expectedAnnualReward: string;
    expectedMonthlyReward: string;
    expectedFiatAnnualReward: number;
    expectedFiatMonthlyReward: number;
    tokenInfo: TokenInfo;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
    this.status = args.status;
    this.estimatedEntryTime = args.estimatedEntryTime;
    this.estimatedExitTime = args.estimatedExitTime;
    this.estimatedWithdrawalTime = args.estimatedWithdrawalTime;
    this.fee = args.fee;
    this.monthlyNrr = args.monthlyNrr;
    this.annualNrr = args.annualNrr;
    this.value = args.value;
    this.numValidators = args.numValidators;
    this.expectedAnnualReward = args.expectedAnnualReward;
    this.expectedMonthlyReward = args.expectedMonthlyReward;
    this.expectedFiatAnnualReward = args.expectedFiatAnnualReward;
    this.expectedFiatMonthlyReward = args.expectedFiatMonthlyReward;
    this.tokenInfo = args.tokenInfo;
  }
}
