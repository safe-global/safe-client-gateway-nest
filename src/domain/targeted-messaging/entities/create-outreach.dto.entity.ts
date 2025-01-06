import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { z } from 'zod';

export const CreateOutreachDtoSchema = z.object({
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  sourceId: z
    .number()
    .int()
    .gte(1)
    .lte(DB_MAX_SAFE_INTEGER - 1),
  type: z.string(),
  teamName: z.string(),
  sourceFile: z.string().nullish().default(null),
  sourceFileProcessedDate: z.coerce.date().nullish().default(null),
  sourceFileChecksum: z.string().nullish().default(null),
  targetAll: z.boolean(),
});

export class CreateOutreachDto
  implements z.infer<typeof CreateOutreachDtoSchema>
{
  name: string;
  startDate: Date;
  endDate: Date;
  sourceId: number;
  type: string;
  teamName: string;
  sourceFile: string | null;
  sourceFileProcessedDate: Date | null;
  sourceFileChecksum: string | null;
  targetAll: boolean;

  constructor(props: CreateOutreachDto) {
    this.name = props.name;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.sourceId = props.sourceId;
    this.type = props.type;
    this.teamName = props.teamName;
    this.sourceFile = props.sourceFile;
    this.sourceFileProcessedDate = props.sourceFileProcessedDate;
    this.sourceFileChecksum = props.sourceFileChecksum;
    this.targetAll = props.targetAll;
  }
}
