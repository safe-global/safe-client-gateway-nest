import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';

export class CustomTransactionInfo extends TransactionInfo {
  @ApiProperty()
  to: AddressInfo;
  @ApiProperty()
  dataSize: string;
  @ApiProperty()
  value: string;
  @ApiProperty()
  isCancellation: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  methodName: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  actionCount: number | null;

  constructor(
    to: AddressInfo,
    dataSize: string,
    value: string,
    methodName: string | null,
    actionCount: number | null,
    isCancellation: boolean,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null | undefined,
  ) {
    super(TransactionInfoType.Custom, humanDescription, richDecodedInfo);
    this.to = to;
    this.dataSize = dataSize;
    this.value = value;
    this.methodName = methodName;
    this.actionCount = actionCount;
    this.isCancellation = isCancellation;
  }
}
