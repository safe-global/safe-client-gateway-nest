import { ApiProperty } from '@nestjs/swagger';
import { Token } from '@/routes/balances/entities/token.entity';

export class Balance {
  @ApiProperty()
  balance!: string;
  @ApiProperty()
  fiatBalance!: string;
  @ApiProperty()
  fiatConversion!: string;
  @ApiProperty()
  tokenInfo!: Token;
}
