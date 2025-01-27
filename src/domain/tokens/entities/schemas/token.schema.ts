import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { TokenType } from '@/domain/tokens/entities/token.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const DEFAULT_DECIMALS = 18;

export const TokenSchema = z.object({
  address: AddressSchema,
  decimals: z.number().default(DEFAULT_DECIMALS),
  logoUri: z.string(),
  name: z.string(),
  symbol: z.string(),
  type: z.nativeEnum(TokenType),
  trusted: z.boolean(),
});

export const TokenPageSchema = buildPageSchema(TokenSchema);
