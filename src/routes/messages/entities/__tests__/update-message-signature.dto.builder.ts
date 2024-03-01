import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { UpdateMessageSignatureDto } from '@/routes/messages/entities/update-message-signature.entity';

export function updateMessageSignatureDtoBuilder(): IBuilder<UpdateMessageSignatureDto> {
  return new Builder<UpdateMessageSignatureDto>().with(
    'signature',
    faker.string.hexadecimal({ length: 32 }),
  );
}
