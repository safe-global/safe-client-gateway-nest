import { Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import {
  TRANSACTION_ID_SEPARATOR,
  TRANSFER_PREFIX,
} from '@/routes/transactions/constants';
import { TransactionDetails } from '@/routes/transactions/entities/transaction-details/transaction-details.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';

@Injectable()
export class TransferDetailsMapper {
  constructor(private readonly transferInfoMapper: TransferInfoMapper) {}

  async mapDetails(
    chainId: string,
    transfer: Transfer,
    safe: Safe,
  ): Promise<TransactionDetails> {
    return {
      safeAddress: safe.address,
      txId: `${TRANSFER_PREFIX}${TRANSACTION_ID_SEPARATOR}${safe.address}${TRANSACTION_ID_SEPARATOR}${transfer.transferId}`,
      executedAt: transfer.executionDate.getTime(),
      txStatus: TransactionStatus.Success,
      txInfo: await this.transferInfoMapper.mapTransferInfo(
        chainId,
        transfer,
        safe,
      ),
      txData: null,
      detailedExecutionInfo: null,
      txHash: transfer.transactionHash,
      safeAppInfo: null,
    };
  }
}
