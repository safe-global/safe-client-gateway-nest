import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export class UpsertAccountDataSettingsDto
  implements z.infer<typeof UpsertAccountDataSettingsDtoSchema>
{
  accountDataSettings: Array<{
    dataTypeId: string;
    enabled: boolean;
  }>;

  constructor(props: UpsertAccountDataSettingsDto) {
    this.accountDataSettings = props.accountDataSettings;
  }
}

export const UpsertAccountDataSettingDtoSchema = z.object({
  dataTypeId: NumericStringSchema,
  enabled: z.boolean(),
});

export const UpsertAccountDataSettingsDtoSchema = z.object({
  accountDataSettings: z.array(UpsertAccountDataSettingDtoSchema),
});
