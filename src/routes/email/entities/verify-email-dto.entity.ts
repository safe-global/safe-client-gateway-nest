import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty()
  signer!: string;

  @ApiProperty()
  code!: string;
}
