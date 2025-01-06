import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  ExecutionInfo,
  ExecutionInfoType,
} from '@/routes/transactions/entities/execution-info.entity';

export class MultisigExecutionInfo extends ExecutionInfo {
  @ApiProperty({ enum: [ExecutionInfoType.Multisig] })
  override type = ExecutionInfoType.Multisig;
  @ApiProperty()
  nonce: number;
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  confirmationsSubmitted: number;
  @ApiPropertyOptional({ type: AddressInfo, isArray: true, nullable: true })
  missingSigners: Array<AddressInfo> | null;

  constructor(
    nonce: number,
    confirmationsRequired: number,
    confirmationsSubmitted: number,
    missingSigners: Array<AddressInfo> | null,
  ) {
    super(ExecutionInfoType.Multisig);
    this.nonce = nonce;
    this.confirmationsRequired = confirmationsRequired;
    this.confirmationsSubmitted = confirmationsSubmitted;
    this.missingSigners = missingSigners;
  }
}
