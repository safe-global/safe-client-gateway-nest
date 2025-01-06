import { ApiProperty } from '@nestjs/swagger';

export class SafeRegistration {
  @ApiProperty()
  chainId!: string;
  @ApiProperty()
  safes!: Array<string>;
  @ApiProperty()
  signatures!: Array<string>;
}
