import { ApiProperty } from '@nestjs/swagger';
import { SafeList as DomainSafeList } from '@/domain/safe/entities/safe-list.entity';

export class SafeList implements DomainSafeList {
  @ApiProperty()
  safes!: string[];
}
