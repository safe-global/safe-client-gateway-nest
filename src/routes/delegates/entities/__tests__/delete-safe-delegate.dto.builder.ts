import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';

export function deleteSafeDelegateDtoBuilder(): IBuilder<DeleteSafeDelegateDto> {
  return new Builder<DeleteSafeDelegateDto>()
    .with('delegate', faker.finance.ethereumAddress())
    .with('safe', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
