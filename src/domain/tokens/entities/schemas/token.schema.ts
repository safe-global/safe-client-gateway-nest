import { JSONSchemaType, Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { Token, TokenType } from '@/domain/tokens/entities/token.entity';

export const TOKEN_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/tokens/token.json';

export const tokenSchema: JSONSchemaType<Token> = {
  $id: TOKEN_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    decimals: { oneOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
    logoUri: { type: 'string' },
    name: { type: 'string' },
    symbol: { type: 'string' },
    type: { type: 'string', enum: Object.values(TokenType) },
    trusted: { type: 'boolean' },
  },
  required: [
    'address',
    'decimals',
    'logoUri',
    'name',
    'symbol',
    'type',
    'trusted',
  ],
};

export const TOKEN_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/tokens/token-page.json';

export const tokenPageSchema: Schema = buildPageSchema(
  TOKEN_PAGE_SCHEMA_ID,
  tokenSchema,
);
