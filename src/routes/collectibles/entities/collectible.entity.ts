import { Collectible as DomainCollectible } from '@/domain/collectibles/entities/collectible.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Collectible implements DomainCollectible {
  @ApiProperty()
  address!: string;
  @ApiProperty()
  tokenName!: string;
  @ApiProperty()
  tokenSymbol!: string;
  @ApiProperty()
  logoUri!: string;
  @ApiProperty()
  id!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  uri!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  name!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  imageUri!: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata!: Record<string, any> | null;
}
