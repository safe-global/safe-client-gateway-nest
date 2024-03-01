import { ApiProperty } from '@nestjs/swagger';

export class SafeRegistration {
  @ApiProperty()
  chainId!: string;
  @ApiProperty()
  safes!: string[];
  @ApiProperty()
  signatures!: string[];
}
