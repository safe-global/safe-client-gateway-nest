import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Delegate } from '@/domain/delegate/entities/delegate.entity';

export function delegateBuilder(): IBuilder<Delegate> {
  return new Builder<Delegate>()
    .with('safe', faker.finance.ethereumAddress())
    .with('delegate', faker.finance.ethereumAddress())
    .with('delegator', faker.finance.ethereumAddress())
    .with('label', faker.word.sample());
}
