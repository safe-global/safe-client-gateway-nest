import { ApiProperty } from '@nestjs/swagger';
import { AddConfirmationDto as DomainCreateConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';

export class AddConfirmationDto implements DomainCreateConfirmationDto {
  @ApiProperty()
  signedSafeTxHash!: string;
}
