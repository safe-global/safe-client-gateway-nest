import { JSONSchemaType } from 'ajv';
import { Balance } from '../balance.entity';
import { TokenInfo } from '../../../common/entities/token-info.entity';
import { TokenType } from '../../../common/entities/token-type.entity';

const tokenInfoSchema: JSONSchemaType<TokenInfo> = {
  type: 'object',
  properties: {
    tokenType: {
      type: 'string',
      enum: [
        TokenType.Erc20,
        TokenType.Erc721,
        TokenType.NativeToken,
        TokenType.Unknown,
      ],
    },
    address: { type: 'string' },
    decimals: { type: 'number' },
    symbol: { type: 'string' },
    name: { type: 'string' },
    logoUri: { type: 'string', nullable: true },
  },
  required: [],
};

const balanceSchema: JSONSchemaType<Balance> = {
  type: 'object',
  properties: {
    tokenInfo: { $ref: 'tokenInfo' },
    balance: { type: 'string' },
    fiatBalance: { type: 'number' },
    fiatConversion: { type: 'number' },
  },
  required: [],
};

export { balanceSchema, tokenInfoSchema };
