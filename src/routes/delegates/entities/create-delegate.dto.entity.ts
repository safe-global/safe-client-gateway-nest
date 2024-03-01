import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDelegateDto {
  @ApiPropertyOptional()
  safe?: string;
  @ApiProperty()
  delegate!: string;
  @ApiProperty()
  delegator!: string;
  @ApiProperty()
  signature!: string;
  @ApiProperty()
  label!: string;
}
