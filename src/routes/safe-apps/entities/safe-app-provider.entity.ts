import { ApiProperty } from '@nestjs/swagger';
import { SafeAppProvider as DomainSafeAppProvider } from '@/domain/safe-apps/entities/safe-app-provider.entity';

export class SafeAppProvider implements DomainSafeAppProvider {
  @ApiProperty()
  url!: string;
  @ApiProperty()
  name!: string;
}
