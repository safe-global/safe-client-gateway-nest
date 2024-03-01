import { NativeCurrency as DomainNativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { ApiProperty } from '@nestjs/swagger';

export class NativeCurrency implements DomainNativeCurrency {
  @ApiProperty()
  decimals!: number;
  @ApiProperty()
  logoUri!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  symbol!: string;
}
