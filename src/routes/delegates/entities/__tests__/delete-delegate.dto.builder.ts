import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { DeleteDelegateDto } from '@/routes/delegates/entities/delete-delegate.dto.entity';

export function deleteDelegateDtoBuilder(): IBuilder<DeleteDelegateDto> {
  return new Builder<DeleteDelegateDto>()
    .with('delegate', faker.finance.ethereumAddress())
    .with('delegator', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
