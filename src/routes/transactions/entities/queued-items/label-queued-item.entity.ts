import { ApiProperty } from '@nestjs/swagger';
import {
  QueuedItem,
  QueuedItemType,
} from '@/routes/transactions/entities/queued-item.entity';

export enum LabelItem {
  Next = 'Next',
  Queued = 'Queued',
}

export class LabelQueuedItem extends QueuedItem {
  @ApiProperty()
  label: string;

  constructor(label: LabelItem) {
    super(QueuedItemType.Label);
    this.label = label;
  }
}
