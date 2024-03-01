import { ApiProperty } from '@nestjs/swagger';

export class SaveEmailDto {
  @ApiProperty()
  emailAddress!: string;

  @ApiProperty()
  signer!: string;

  @ApiProperty()
  timestamp!: number;

  @ApiProperty()
  signature!: string;
}
