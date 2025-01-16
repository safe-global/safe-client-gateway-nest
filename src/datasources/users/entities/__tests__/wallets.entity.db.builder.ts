import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { Wallet } from '@/datasources/users/entities/wallets.entity.db';
import { userBuilder } from '@/datasources/users/entities/__tests__/users.entity.db.builder';
import { getAddress } from 'viem';

export function walletBuilder(): IBuilder<Wallet> {
  return new Builder<Wallet>()
    .with('id', faker.number.int())
    .with('user', userBuilder().build())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('created_at', new Date())
    .with('updated_at', new Date());
}
