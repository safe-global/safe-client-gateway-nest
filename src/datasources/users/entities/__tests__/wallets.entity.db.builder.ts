import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { Wallet } from '@/datasources/users/entities/wallets.entity.db';
import { userBuilder } from '@/datasources/users/entities/__tests__/users.entity.db.builder';

export function walletBuilder(): IBuilder<Wallet> {
  return new Builder<Wallet>()
    .with('id', faker.number.int())
    .with('user', userBuilder().build())
    .with('address', faker.string.hexadecimal({ length: 42 }) as `0x${string}`)
    .with('created_at', new Date())
    .with('updated_at', new Date());
}
