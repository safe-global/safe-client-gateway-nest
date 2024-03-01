import { ApiProperty } from '@nestjs/swagger';

export class DeleteTransactionDto {
  @ApiProperty()
  signature!: string;
}
