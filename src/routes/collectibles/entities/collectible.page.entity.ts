import { ApiProperty } from '@nestjs/swagger';
import { Collectible } from '@/routes/collectibles/entities/collectible.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class CollectiblePage extends Page<Collectible> {
  @ApiProperty({ type: Collectible })
  results!: Collectible[];
}
