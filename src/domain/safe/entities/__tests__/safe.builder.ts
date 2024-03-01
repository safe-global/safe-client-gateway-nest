import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Safe } from '@/domain/safe/entities/safe.entity';

export function safeBuilder(): IBuilder<Safe> {
  return new Builder<Safe>()
    .with('address', faker.finance.ethereumAddress())
    .with('nonce', faker.number.int())
    .with('threshold', faker.number.int())
    .with('owners', [faker.finance.ethereumAddress()])
    .with('masterCopy', faker.finance.ethereumAddress())
    .with('modules', null)
    .with('fallbackHandler', faker.finance.ethereumAddress())
    .with('guard', faker.finance.ethereumAddress())
    .with('version', faker.system.semver());
}
