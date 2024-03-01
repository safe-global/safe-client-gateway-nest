import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';

export function createDelegateDtoBuilder(): IBuilder<CreateDelegateDto> {
  return new Builder<CreateDelegateDto>()
    .with('safe', faker.finance.ethereumAddress())
    .with('delegate', faker.finance.ethereumAddress())
    .with('delegator', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('label', faker.string.hexadecimal({ length: 32 }));
}
