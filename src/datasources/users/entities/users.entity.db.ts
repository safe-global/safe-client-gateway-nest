import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { z } from 'zod';
import { UserStatus } from '@/domain/users/entities/user.entity';

export const UserSchema = RowSchema.extend({
  status: z.nativeEnum(UserStatus),
});

@Entity('users')
export class User implements z.infer<typeof UserSchema> {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
  })
  status!: UserStatus;

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
