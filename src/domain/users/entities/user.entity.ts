import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';

export enum UserStatus {
  ACTIVE = 1,
  PENDING = 2,
}

export type User = z.infer<typeof UserSchema>;

export const UserSchema = RowSchema.extend({
  status: z.nativeEnum(UserStatus),
});
