import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import type { UUID } from 'crypto';
import {
  Column,
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  ManyToOne,
} from 'typeorm';
import { z } from 'zod';
import { getAddress } from 'viem';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { User } from '@/datasources/users/entities/users.entity.db';

export const WalletSchema = RowSchema.extend({
  id: UuidSchema,
  user_id: UuidSchema,
  address: AddressSchema,
});

@Entity('wallets')
@Unique('id', ['id'])
export class Wallet implements z.infer<typeof WalletSchema> {
  @PrimaryGeneratedColumn('uuid')
  id!: UUID;

  @Column({ type: 'uuid' })
  @ManyToOne(() => User, (user) => user.id, {
    onDelete: 'CASCADE',
  })
  user_id!: UUID;

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
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;
}
