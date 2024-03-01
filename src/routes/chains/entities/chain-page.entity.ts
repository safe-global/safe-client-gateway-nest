import { ApiProperty } from '@nestjs/swagger';
import { Chain } from '@/routes/chains/entities/chain.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class ChainPage extends Page<Chain> {
  @ApiProperty({ type: Chain })
  results!: Chain[];
}
