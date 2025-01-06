import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import { CowSwapConfirmationView } from '@/routes/transactions/entities/swaps/swap-confirmation-view.entity';
import { CowSwapTwapConfirmationView } from '@/routes/transactions/entities/swaps/twap-confirmation-view.entity';
import { NativeStakingDepositConfirmationView } from '@/routes/transactions/entities/staking/native-staking-deposit-confirmation-view.entity';
import { NativeStakingValidatorsExitConfirmationView } from '@/routes/transactions/entities/staking/native-staking-validators-exit-confirmation-view.entity';
import { NativeStakingWithdrawConfirmationView } from '@/routes/transactions/entities/staking/native-staking-withdraw-confirmation-view.entity';

export interface Baseline {
  method: string;
  parameters: Array<DataDecodedParameter> | null;
}

export enum DecodedType {
  Generic = 'GENERIC',
  CowSwapOrder = 'COW_SWAP_ORDER',
  CowSwapTwapOrder = 'COW_SWAP_TWAP_ORDER',
  KilnNativeStakingDeposit = 'KILN_NATIVE_STAKING_DEPOSIT',
  KilnNativeStakingValidatorsExit = 'KILN_NATIVE_STAKING_VALIDATORS_EXIT',
  KilnNativeStakingWithdraw = 'KILN_NATIVE_STAKING_WITHDRAW',
}

export type ConfirmationView =
  | BaselineConfirmationView
  | CowSwapConfirmationView
  | CowSwapTwapConfirmationView
  | NativeStakingDepositConfirmationView
  | NativeStakingValidatorsExitConfirmationView
  | NativeStakingWithdrawConfirmationView;

export class BaselineConfirmationView implements Baseline {
  @ApiProperty({ enum: [DecodedType.Generic] })
  type = DecodedType.Generic;

  @ApiProperty()
  method: string;

  @ApiPropertyOptional({
    type: DataDecodedParameter,
    isArray: true,
    nullable: true,
  })
  parameters: Array<DataDecodedParameter> | null;

  constructor(args: {
    method: string;
    parameters: Array<DataDecodedParameter> | null;
  }) {
    this.method = args.method;
    this.parameters = args.parameters;
  }
}
