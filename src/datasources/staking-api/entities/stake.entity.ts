import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const StakeSchema = z.object({
  validator_address: HexSchema.refine((value) => value.length === 96),
  state: z.string(),
  effective_balance: NumericStringSchema,
  rewards: NumericStringSchema,
});

export type Stake = z.infer<typeof StakeSchema>;
