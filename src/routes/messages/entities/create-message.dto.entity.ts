import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty()
  message: string | unknown;
  @ApiPropertyOptional({ type: Number, nullable: true })
  safeAppId!: number | null;
  @ApiProperty()
  signature!: string;
}
