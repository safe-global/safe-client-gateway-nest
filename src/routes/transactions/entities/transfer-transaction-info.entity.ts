import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';
import {
  TransactionInfo,
  TransactionInfoType,
} from '@/routes/transactions/entities/transaction-info.entity';
import { Transfer } from '@/routes/transactions/entities/transfers/transfer.entity';

export enum TransferDirection {
  Incoming = 'INCOMING',
  Outgoing = 'OUTGOING',
  Unknown = 'UNKNOWN',
}

export class TransferTransactionInfo extends TransactionInfo {
  @ApiProperty()
  sender: AddressInfo;
  @ApiProperty()
  recipient: AddressInfo;
  @ApiProperty()
  direction: string;
  @ApiProperty()
  transferInfo: Transfer;

  constructor(
    sender: AddressInfo,
    recipient: AddressInfo,
    direction: string,
    transferInfo: Transfer,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null | undefined,
  ) {
    super(TransactionInfoType.Transfer, humanDescription, richDecodedInfo);
    this.sender = sender;
    this.recipient = recipient;
    this.direction = direction;
    this.transferInfo = transferInfo;
  }
}

export function isTransferTransactionInfo(
  txInfo: TransactionInfo,
): txInfo is TransferTransactionInfo {
  return txInfo.type === TransactionInfoType.Transfer;
}
