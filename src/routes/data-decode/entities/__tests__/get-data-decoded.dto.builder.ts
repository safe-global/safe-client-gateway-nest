import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { GetDataDecodedDto } from '@/routes/data-decode/entities/get-data-decoded.dto.entity';

export function getDataDecodedDtoBuilder(): IBuilder<GetDataDecodedDto> {
  return new Builder<GetDataDecodedDto>()
    .with('data', faker.string.hexadecimal())
    .with('to', faker.finance.ethereumAddress());
}
