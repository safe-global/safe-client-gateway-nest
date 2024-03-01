import { ApiProperty } from '@nestjs/swagger';
import { GasPriceOracle as DomainGasPriceOracle } from '@/domain/chains/entities/gas-price-oracle.entity';

export class GasPriceOracle implements DomainGasPriceOracle {
  @ApiProperty()
  type!: 'oracle';
  @ApiProperty()
  gasParameter!: string;
  @ApiProperty()
  gweiFactor!: string;
  @ApiProperty()
  uri!: string;
}
