import { JSONSchemaType, Schema } from 'ajv';
import { BalanceToken } from '@/domain/balances/entities/balance.token.entity';

export const BALANCE_TOKEN_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/balances/balance-token.json';

const balanceTokenSchema: JSONSchemaType<BalanceToken> = {
  $id: BALANCE_TOKEN_SCHEMA_ID,
  type: 'object',
  properties: {
    name: { type: 'string' },
    symbol: { type: 'string' },
    decimals: { type: 'number' },
    logoUri: { type: 'string' },
  },
  required: ['name', 'symbol', 'decimals', 'logoUri'],
};

export const BALANCE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/balances/balance.json';

const balanceSchema: Schema = {
  $id: BALANCE_SCHEMA_ID,
  type: 'object',
  properties: {
    tokenAddress: { type: 'string', nullable: true, default: null },
    token: { anyOf: [{ type: 'null' }, { $ref: 'balance-token.json' }] },
    balance: { type: 'string' },
  },
  required: ['balance'],
};

export { balanceSchema, balanceTokenSchema };
