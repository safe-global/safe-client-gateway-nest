import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';

@ApiExtraModels(TransactionItem, DateLabel)
export class TransactionItemPage extends Page<TransactionItem | DateLabel> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(TransactionItem) },
      { $ref: getSchemaPath(DateLabel) },
    ],
  })
  results!: (TransactionItem | DateLabel)[];
}
