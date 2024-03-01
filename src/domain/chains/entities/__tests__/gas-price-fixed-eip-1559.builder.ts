import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { GasPriceFixedEIP1559 } from '@/domain/chains/entities/gas-price-fixed-eip-1559.entity';

export function gasPriceFixedEIP1559Builder(): IBuilder<GasPriceFixedEIP1559> {
  return new Builder<GasPriceFixedEIP1559>()
    .with('type', 'fixed1559')
    .with('maxFeePerGas', faker.string.numeric())
    .with('maxPriorityFeePerGas', faker.string.numeric());
}
