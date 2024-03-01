import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Estimation } from '@/domain/estimations/entities/estimation.entity';

export function estimationBuilder(): IBuilder<Estimation> {
  return new Builder<Estimation>().with('safeTxGas', faker.string.numeric(5));
}
