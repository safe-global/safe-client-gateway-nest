import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import {
  TransferTransactionInfo,
  TransferDirection,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { TransactionInfoType } from '@/routes/transactions/entities/transaction-info.entity';
import { TransferType } from '@/routes/transactions/entities/transfers/transfer.entity';

export function transferTransactionInfoBuilder(): IBuilder<TransferTransactionInfo> {
  return new Builder<TransferTransactionInfo>()
    .with('type', TransactionInfoType.Transfer)
    .with('sender', addressInfoBuilder().build())
    .with('recipient', addressInfoBuilder().build())
    .with('direction', faker.helpers.objectValue(TransferDirection))
    .with('transferInfo', {
      ...erc20TransferBuilder().build(),
      type: TransferType.Erc20,
    });
}
