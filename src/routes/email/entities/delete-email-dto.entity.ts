import { ApiProperty } from '@nestjs/swagger';

export class DeleteEmailDto {
  @ApiProperty()
  signer!: string;

  @ApiProperty()
  timestamp!: number;

  @ApiProperty()
  signature!: string;
}
