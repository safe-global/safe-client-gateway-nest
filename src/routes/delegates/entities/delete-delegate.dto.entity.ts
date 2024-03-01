import { ApiProperty } from '@nestjs/swagger';

export class DeleteDelegateDto {
  @ApiProperty()
  delegate!: string;
  @ApiProperty()
  delegator!: string;
  @ApiProperty()
  signature!: string;
}
