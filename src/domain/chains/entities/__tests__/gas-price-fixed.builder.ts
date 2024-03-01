import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { GasPriceFixed } from '@/domain/chains/entities/gas-price-fixed.entity';

export function gasPriceFixedBuilder(): IBuilder<GasPriceFixed> {
  return new Builder<GasPriceFixed>()
    .with('type', 'fixed')
    .with('weiValue', faker.string.numeric());
}
