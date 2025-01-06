import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { CreateOutreachDto } from '@/domain/targeted-messaging/entities/create-outreach.dto.entity';
import { faker } from '@faker-js/faker/.';

export function createOutreachDtoBuilder(): IBuilder<CreateOutreachDto> {
  const startDate = faker.date.recent();

  return new Builder<CreateOutreachDto>()
    .with('name', faker.string.alphanumeric(5))
    .with('startDate', startDate)
    .with('endDate', faker.date.future({ refDate: startDate }))
    .with('sourceId', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('type', faker.string.alphanumeric(5))
    .with('teamName', faker.string.alphanumeric(5))
    .with('sourceFile', `${faker.string.alphanumeric(5)}.json`)
    .with('sourceFileProcessedDate', null)
    .with('sourceFileChecksum', null)
    .with('targetAll', faker.datatype.boolean());
}
