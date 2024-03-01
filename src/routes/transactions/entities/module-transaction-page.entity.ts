import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { ModuleTransaction } from '@/routes/transactions/entities/module-transaction.entity';

export class ModuleTransactionPage extends Page<ModuleTransaction> {
  @ApiProperty({ type: ModuleTransaction })
  results!: ModuleTransaction[];
}
