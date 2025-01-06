import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const SafeSchema = z.object({
  address: AddressSchema,
  // nonce was changed from a number to string on the the Transaction Service
  // @see https://github.com/safe-global/safe-transaction-service/pull/2367
  // TODO: only allow strings after Transaction Service is on prod.
  nonce: z.union([z.number(), z.string()]).pipe(z.coerce.number()),
  threshold: z.number(),
  owners: z.array(AddressSchema),
  masterCopy: AddressSchema,
  modules: z.array(AddressSchema).nullish().default(null),
  fallbackHandler: AddressSchema,
  guard: AddressSchema,
  version: z.string().nullish().default(null),
});
