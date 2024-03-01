import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { Delegate } from '@/routes/delegates/entities/delegate.entity';

export class DelegatePage extends Page<Delegate> {
  @ApiProperty({ type: Delegate })
  results!: Delegate[];
}
