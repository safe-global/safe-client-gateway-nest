import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import {
  MODULE_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/routes/transactions/constants';
import { ModuleExecutionInfo } from '@/routes/transactions/entities/module-execution-info.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-status.mapper';

@Injectable()
export class ModuleTransactionMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: ModuleTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: ModuleTransaction,
  ): Promise<Transaction> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
    );
    const executionInfo = new ModuleExecutionInfo(
      await this.addressInfoHelper.getOrDefault(chainId, transaction.module, [
        'CONTRACT',
      ]),
    );

    return new Transaction(
      `${MODULE_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.moduleTransactionId}`,
      transaction.executionDate.getTime(),
      txStatus,
      txInfo,
      executionInfo,
      null,
    );
  }
}
