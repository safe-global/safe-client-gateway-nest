import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import {
  MODULE_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/routes/transactions/constants';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { ModuleExecutionDetails } from '@/routes/transactions/entities/transaction-details/module-execution-details.entity';
import { TransactionDetails } from '@/routes/transactions/entities/transaction-details/transaction-details.entity';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-status.mapper';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';

@Injectable()
export class ModuleTransactionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: ModuleTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
  ) {}

  async mapDetails(
    chainId: string,
    transaction: ModuleTransaction,
  ): Promise<TransactionDetails> {
    const [moduleAddress, txInfo, txData] = await Promise.all([
      this.addressInfoHelper.getOrDefault(chainId, transaction.module, [
        'CONTRACT',
      ]),
      this.transactionInfoMapper.mapTransactionInfo(chainId, transaction),
      this.mapTransactionData(chainId, transaction),
    ]);

    return {
      safeAddress: transaction.safe,
      txId: `${MODULE_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.moduleTransactionId}`,
      executedAt: transaction.executionDate.getTime(),
      txStatus: this.statusMapper.mapTransactionStatus(transaction),
      txInfo,
      txData,
      txHash: transaction.transactionHash,
      detailedExecutionInfo: new ModuleExecutionDetails(moduleAddress),
      safeAppInfo: null,
    };
  }

  private async mapTransactionData(
    chainId: string,
    transaction: ModuleTransaction,
  ): Promise<TransactionData> {
    const [addressInfoIndex, trustedDelegateCallTarget, toAddress] =
      await Promise.all([
        this.transactionDataMapper.buildAddressInfoIndex(
          chainId,
          transaction.dataDecoded,
        ),
        this.transactionDataMapper.isTrustedDelegateCall(
          chainId,
          transaction.operation,
          transaction.to,
          transaction.dataDecoded,
        ),
        this.addressInfoHelper.getOrDefault(chainId, transaction.to, [
          'TOKEN',
          'CONTRACT',
        ]),
      ]);

    return {
      to: toAddress,
      value: transaction.value,
      hexData: transaction.data,
      dataDecoded: transaction.dataDecoded,
      operation: transaction.operation,
      addressInfoIndex: isEmpty(addressInfoIndex) ? null : addressInfoIndex,
      trustedDelegateCallTarget,
    };
  }
}
