import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  UserStatus,
  User as DomainUser,
} from '@/domain/users/entities/user.entity';

@Entity('users')
export class User implements DomainUser {
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
