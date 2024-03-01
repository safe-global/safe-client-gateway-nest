import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SafeAppAccessControl as DomainSafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '@/domain/safe-apps/entities/safe-app-access-control.entity';

export class SafeAppAccessControl implements DomainSafeAppAccessControl {
  @ApiProperty()
  type!: SafeAppAccessControlPolicies;
  @ApiPropertyOptional({ type: String, isArray: true, nullable: true })
  value!: string[] | null;
}
