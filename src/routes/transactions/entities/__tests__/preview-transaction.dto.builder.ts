import { faker } from '@faker-js/faker';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { Builder, IBuilder } from '@/__tests__/builder';
import { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';

export function previewTransactionDtoBuilder(): IBuilder<PreviewTransactionDto> {
  return new Builder<PreviewTransactionDto>()
    .with('to', faker.finance.ethereumAddress())
    .with('data', faker.string.hexadecimal({ length: 32 }))
    .with('value', faker.string.numeric())
    .with('operation', faker.helpers.arrayElement([0, 1]) as Operation);
}
