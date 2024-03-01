import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import {
  Account,
  EmailAddress,
} from '@/domain/account/entities/account.entity';

export function accountBuilder(): IBuilder<Account> {
  return new Builder<Account>()
    .with('chainId', faker.string.numeric())
    .with('emailAddress', new EmailAddress(faker.internet.email()))
    .with('isVerified', faker.datatype.boolean())
    .with('safeAddress', faker.finance.ethereumAddress())
    .with('signer', faker.finance.ethereumAddress())
    .with('verificationCode', null)
    .with('verificationGeneratedOn', null)
    .with('verificationSentOn', null);
}
