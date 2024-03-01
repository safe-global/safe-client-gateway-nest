import { ApiProperty } from '@nestjs/swagger';
import { GasPriceFixedEIP1559 as DomainGasPriceFixedEIP1559 } from '@/domain/chains/entities/gas-price-fixed-eip-1559.entity';

export class GasPriceFixedEIP1559 implements DomainGasPriceFixedEIP1559 {
  @ApiProperty()
  type!: 'fixed1559';
  @ApiProperty()
  maxFeePerGas!: string;
  @ApiProperty()
  maxPriorityFeePerGas!: string;
}
