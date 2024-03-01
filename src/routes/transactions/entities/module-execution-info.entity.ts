import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  ExecutionInfo,
  ExecutionInfoType,
} from '@/routes/transactions/entities/execution-info.entity';

export class ModuleExecutionInfo extends ExecutionInfo {
  @ApiProperty()
  address: AddressInfo;

  constructor(address: AddressInfo) {
    super(ExecutionInfoType.Module);
    this.address = address;
  }
}
