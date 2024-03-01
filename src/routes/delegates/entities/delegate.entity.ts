import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Delegate {
  @ApiPropertyOptional({ type: String, nullable: true })
  safe!: string | null;
  @ApiProperty()
  delegate!: string;
  @ApiProperty()
  delegator!: string;
  @ApiProperty()
  label!: string;
}
