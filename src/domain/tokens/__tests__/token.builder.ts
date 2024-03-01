import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Token, TokenType } from '@/domain/tokens/entities/token.entity';

export function tokenBuilder(): IBuilder<Token> {
  return new Builder<Token>()
    .with('address', faker.finance.ethereumAddress())
    .with('decimals', faker.number.int())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample())
    .with('symbol', faker.finance.currencySymbol())
    .with('type', faker.helpers.arrayElement(Object.values(TokenType)))
    .with('trusted', faker.datatype.boolean());
}
