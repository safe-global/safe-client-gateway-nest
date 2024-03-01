import { ApiProperty } from '@nestjs/swagger';
import { SafeAppSocialProfile as DomainSafeAppSocialProfile } from '@/domain/safe-apps/entities/safe-app-social-profile.entity';

export class SafeAppSocialProfile implements DomainSafeAppSocialProfile {
  @ApiProperty()
  platform!: string;
  @ApiProperty()
  url!: string;
}
