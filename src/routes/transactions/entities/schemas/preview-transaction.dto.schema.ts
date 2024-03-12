import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const PreviewTransactionDtoSchema = z.object({
  to: AddressSchema,
  data: HexSchema.nullish().default(null),
  value: z.string(),
  operation: z.nativeEnum(Operation),
});
