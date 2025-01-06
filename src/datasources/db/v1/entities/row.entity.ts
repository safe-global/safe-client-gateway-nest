import { z } from 'zod';

export type Row = z.infer<typeof RowSchema>;

/**
 * Note: this is a base schema for all entities that are meant to be persisted to the database.
 * The 'id' field is a primary key, and the 'created_at' and 'updated_at' fields are timestamps.
 * These fields shouldn't be modified by the application, and should be managed by the database.
 */
export const RowSchema = z.object({
  id: z.number().int(),
  created_at: z.coerce.date(), // @TODO when migrated all the entities to TypeOrm Remove `.coerce`
  updated_at: z.coerce.date(),
});
