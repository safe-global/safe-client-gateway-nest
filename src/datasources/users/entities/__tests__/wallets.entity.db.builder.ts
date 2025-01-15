import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { UUID } from 'crypto';
import type { Wallet } from '@/datasources/users/entities/wallets.entity.db';

export function walletBuilder(): IBuilder<Wallet> {
  return new Builder<Wallet>()
    .with('id', faker.string.uuid() as UUID)
    .with('user_id', faker.string.uuid() as UUID)
    .with('address', faker.string.hexadecimal({ length: 42 }) as `0x${string}`)
    .with('created_at', new Date())
    .with('updated_at', new Date());
}
