import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import {
  Column,
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { z } from 'zod';
import { getAddress } from 'viem';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { User } from '@/datasources/users/entities/users.entity.db';
import { UserSchema } from '@/domain/users/entities/user.entity';

export const WalletSchema = RowSchema.extend({
  address: AddressSchema,
  user: UserSchema,
});

@Entity('wallets')
@Unique('UQ_wallet_address', ['address'])
export class Wallet implements z.infer<typeof WalletSchema> {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_wallet_id' })
  id!: number;

  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_wallets_user_id',
  })
  user!: User;

  @Column({
    type: 'varchar',
    length: 42,
    transformer: {
      from(value: string): `0x${string}` {
        return getAddress(value);
      },
      to(value: string): `0x${string}` {
        return getAddress(value);
      },
    },
  })
  address!: `0x${string}`;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;
}
