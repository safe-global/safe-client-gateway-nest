import { ApiProperty } from '@nestjs/swagger';
import { TokenType } from '@/routes/balances/entities/token-type.entity';

export class Token {
  @ApiProperty()
  address!: `0x${string}`;
  @ApiProperty()
  decimals!: number;
  @ApiProperty()
  logoUri?: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
  @ApiProperty({ enum: Object.values(TokenType) })
  type!: TokenType;
}
