import { ApiProperty } from '@nestjs/swagger';
import { GasPriceFixed as DomainGasPriceFixed } from '@/domain/chains/entities/gas-price-fixed.entity';

export class GasPriceFixed implements DomainGasPriceFixed {
  @ApiProperty()
  type!: 'fixed';
  @ApiProperty()
  weiValue!: string;
}
