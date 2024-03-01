import { ApiProperty } from '@nestjs/swagger';

export class EditEmailDto {
  @ApiProperty()
  emailAddress!: string;

  @ApiProperty()
  signer!: string;

  @ApiProperty()
  timestamp!: number;

  @ApiProperty()
  signature!: string;
}
