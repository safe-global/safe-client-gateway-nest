import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenType } from '@/routes/balances/entities/token-type.entity';

export class Token {
  @ApiProperty()
  address!: string;
  @ApiPropertyOptional({ type: Number, nullable: true })
  decimals!: number | null;
  @ApiProperty()
  logoUri?: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
  @ApiProperty({ enum: Object.values(TokenType) })
  type!: TokenType;
}
