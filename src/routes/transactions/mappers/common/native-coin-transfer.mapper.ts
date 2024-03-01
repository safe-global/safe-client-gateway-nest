import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  TransferTransactionInfo,
  TransferDirection,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { NativeCoinTransfer } from '@/routes/transactions/entities/transfers/native-coin-transfer.entity';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';

@Injectable()
export class NativeCoinTransferMapper {
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapNativeCoinTransfer(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null | undefined,
  ): Promise<TransferTransactionInfo> {
    const recipient = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
      ['TOKEN', 'CONTRACT'],
    );

    return new TransferTransactionInfo(
      new AddressInfo(transaction.safe),
      recipient,
      TransferDirection.Outgoing,
      new NativeCoinTransfer(transaction.value),
      humanDescription,
      richDecodedInfo,
    );
  }
}
