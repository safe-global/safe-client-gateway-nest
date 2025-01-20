import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  UserStatus,
  User as DomainUser,
} from '@/domain/users/entities/user.entity';

@Entity('users')
export class User implements DomainUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({
    type: 'integer',
    enum: UserStatus,
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
