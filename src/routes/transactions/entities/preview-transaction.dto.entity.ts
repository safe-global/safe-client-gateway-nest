import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';

export class PreviewTransactionDto {
  @ApiProperty()
  to!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: string | null;
  @ApiProperty()
  value!: string;
  @ApiProperty()
  operation!: Operation;
}
