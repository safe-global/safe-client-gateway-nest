import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GetEstimationDto as DomainGetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';

export class GetEstimationDto implements DomainGetEstimationDto {
  @ApiProperty()
  to!: string;
  @ApiProperty()
  value!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: string | null;
  @ApiProperty()
  operation!: Operation;
}
