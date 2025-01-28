import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  OrganisationStatus,
  Organisation as DomainOrganisation,
} from '@/domain/organisations/entities/organisation.entity';

@Entity('organisations')
export class Organisations implements DomainOrganisation {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_org_id' })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index('idx_org_status')
  @Column({
    type: 'integer',
  })
  status!: OrganisationStatus;

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
