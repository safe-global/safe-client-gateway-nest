import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  UserStatus,
  User as DomainUser,
} from '@/domain/users/entities/user.entity';

@Entity('users')
export class User implements DomainUser {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_id' })
  id!: number;

  @Index('idx_user_status')
  @Column({
    type: 'integer',
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
