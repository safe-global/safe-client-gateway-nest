import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';

export enum OrganisationStatus {
  ACTIVE = 1,
  INACTIVE = 2,
}

export type Organisation = z.infer<typeof OrganisationSchema>;

export const OrganisationSchema = RowSchema.extend({
  status: z.nativeEnum(OrganisationStatus),
});
