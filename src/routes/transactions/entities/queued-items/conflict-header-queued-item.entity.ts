import { ApiProperty } from '@nestjs/swagger';
import {
  QueuedItem,
  QueuedItemType,
} from '@/routes/transactions/entities/queued-item.entity';

export class ConflictHeaderQueuedItem extends QueuedItem {
  @ApiProperty()
  nonce: number;

  constructor(nonce: number) {
    super(QueuedItemType.ConflictHeader);
    this.nonce = nonce;
  }
}
