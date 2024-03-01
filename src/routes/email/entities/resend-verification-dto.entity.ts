import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty()
  signer!: string;
}
