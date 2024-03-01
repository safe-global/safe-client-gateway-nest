import { ApiProperty } from '@nestjs/swagger';

export class DeleteSafeDelegateDto {
  @ApiProperty()
  delegate!: string;
  @ApiProperty()
  safe!: string;
  @ApiProperty()
  signature!: string;
}
