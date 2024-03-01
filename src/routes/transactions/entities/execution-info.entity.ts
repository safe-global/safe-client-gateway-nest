import { ApiProperty } from '@nestjs/swagger';

export enum ExecutionInfoType {
  Multisig = 'MULTISIG',
  Module = 'MODULE',
}

export abstract class ExecutionInfo {
  @ApiProperty()
  type: ExecutionInfoType;

  protected constructor(type: ExecutionInfoType) {
    this.type = type;
  }
}
