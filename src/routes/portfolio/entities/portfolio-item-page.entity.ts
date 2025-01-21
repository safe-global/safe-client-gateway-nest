import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { PositionItem } from '@/routes/portfolio/entities/position-item.entity';

@ApiExtraModels(PositionItem)
export class PortfolioItemPage extends Page<PositionItem> {
  @ApiProperty({
    type: [PositionItem],
    isArray: true,
  })
  results!: Array<PositionItem>;

  constructor(args: {
    results: Array<PositionItem>;
    count: number;
    next: string | null;
    previous: string | null;
  }) {
    super();
    this.results = args.results;
    this.count = args.count;
    this.next = args.next;
    this.previous = args.previous;
  }
}
