import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { QueuedItem } from '@/routes/transactions/entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '@/routes/transactions/entities/queued-items/conflict-header-queued-item.entity';
import { LabelQueuedItem } from '@/routes/transactions/entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '@/routes/transactions/entities/queued-items/transaction-queued-item.entity';

@ApiExtraModels(
  ConflictHeaderQueuedItem,
  LabelQueuedItem,
  TransactionQueuedItem,
)
export class QueuedItemPage extends Page<QueuedItem> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(ConflictHeaderQueuedItem) },
      { $ref: getSchemaPath(LabelQueuedItem) },
      { $ref: getSchemaPath(TransactionQueuedItem) },
    ],
  })
  results!: QueuedItem[];
}
