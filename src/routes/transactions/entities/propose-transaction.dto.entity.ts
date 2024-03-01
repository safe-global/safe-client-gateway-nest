import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { ProposeTransactionDto as DomainProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

export class ProposeTransactionDto implements DomainProposeTransactionDto {
  @ApiProperty()
  to!: string;
  @ApiProperty()
  value!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: string | null;
  @ApiProperty()
  nonce!: string;
  @ApiProperty()
  operation!: Operation;
  @ApiProperty()
  safeTxGas!: string;
  @ApiProperty()
  baseGas!: string;
  @ApiProperty()
  gasPrice!: string;
  @ApiProperty()
  gasToken!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  refundReceiver!: string | null;
  @ApiProperty()
  safeTxHash!: string;
  @ApiProperty()
  sender!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  signature!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin!: string | null;
}
