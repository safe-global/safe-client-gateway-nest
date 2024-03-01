import { Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import {
  TRANSACTION_ID_SEPARATOR,
  TRANSFER_PREFIX,
} from '@/routes/transactions/constants';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';

@Injectable()
export class TransferMapper {
  constructor(private readonly transferInfoMapper: TransferInfoMapper) {}

  async mapTransfer(
    chainId: string,
    transfer: Transfer,
    safe: Safe,
  ): Promise<Transaction> {
    return new Transaction(
      `${TRANSFER_PREFIX}${TRANSACTION_ID_SEPARATOR}${safe.address}${TRANSACTION_ID_SEPARATOR}${transfer.transferId}`,
      transfer.executionDate.getTime(),
      TransactionStatus.Success,
      await this.transferInfoMapper.mapTransferInfo(chainId, transfer, safe),
      null,
      null,
    );
  }
}
