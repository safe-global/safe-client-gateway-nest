import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { AddConfirmationDto } from '@/routes/transactions/entities/add-confirmation.dto';

export function addConfirmationDtoBuilder(): IBuilder<AddConfirmationDto> {
  return new Builder<AddConfirmationDto>().with(
    'signedSafeTxHash',
    faker.string.hexadecimal({ length: 32 }),
  );
}
