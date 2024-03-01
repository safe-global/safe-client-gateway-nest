import { ApiProperty } from '@nestjs/swagger';
import {
  Transfer,
  TransferType,
} from '@/routes/transactions/entities/transfers/transfer.entity';

export class NativeCoinTransfer extends Transfer {
  @ApiProperty()
  value: string;

  constructor(value: string) {
    super(TransferType.NativeCoin);
    this.value = value;
  }
}
