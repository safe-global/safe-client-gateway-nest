import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/routes/transactions/constants';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';

@Injectable()
export class MultisigTransactionMapper {
  constructor(
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly executionInfoMapper: MultisigTransactionExecutionInfoMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<Transaction> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction, safe);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
    );
    const executionInfo = this.executionInfoMapper.mapExecutionInfo(
      transaction,
      safe,
      txStatus,
    );
    const safeAppInfo = await this.safeAppInfoMapper.mapSafeAppInfo(
      chainId,
      transaction,
    );

    return new Transaction(
      `${MULTISIG_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.safeTxHash}`,
      (transaction.executionDate ?? transaction.submissionDate).getTime(),
      txStatus,
      txInfo,
      executionInfo,
      safeAppInfo,
    );
  }
}
