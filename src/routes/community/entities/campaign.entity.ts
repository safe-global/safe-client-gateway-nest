import { Campaign as DomainCampaign } from '@/domain/community/entities/campaign.entity';
import { ActivityMetadata } from '@/routes/community/entities/activity-metadata.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Campaign implements DomainCampaign {
  @ApiProperty()
  resourceId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty({ type: String })
  startDate!: Date;
  @ApiProperty({ type: String })
  endDate!: Date;
  @ApiPropertyOptional({ type: String, nullable: true })
  lastUpdated!: Date | null;
  @ApiPropertyOptional({
    type: ActivityMetadata,
    isArray: true,
    nullable: true,
  })
  activitiesMetadata!: Array<ActivityMetadata> | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  rewardValue!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  rewardText!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  iconUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safeAppUrl!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  partnerUrl!: string | null;
  @ApiProperty()
  isPromoted!: boolean;
}
