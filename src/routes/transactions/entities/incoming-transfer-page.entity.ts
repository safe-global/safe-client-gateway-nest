import { ApiProperty } from '@nestjs/swagger';
import { Page } from '@/routes/common/entities/page.entity';
import { IncomingTransfer } from '@/routes/transactions/entities/incoming-transfer.entity';

export class IncomingTransferPage extends Page<IncomingTransfer> {
  @ApiProperty({ type: IncomingTransfer })
  results!: IncomingTransfer[];
}
