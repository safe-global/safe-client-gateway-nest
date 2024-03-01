import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageSignatureDto {
  @ApiProperty()
  signature!: string;
}
