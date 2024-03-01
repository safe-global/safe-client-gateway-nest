import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { isMultisigTransaction } from '@/domain/safe/entities/transaction.entity';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import {
  MULTI_SEND_METHOD_NAME,
  TRANSACTIONS_PARAMETER_NAME,
} from '@/routes/transactions/constants';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';

@Injectable()
export class CustomTransactionMapper {
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapCustomTransaction(
    transaction: MultisigTransaction | ModuleTransaction,
    dataSize: number,
    chainId: string,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null | undefined,
  ): Promise<CustomTransactionInfo> {
    const toAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
      ['TOKEN', 'CONTRACT'],
    );

    return new CustomTransactionInfo(
      toAddressInfo,
      dataSize.toString(),
      transaction.value,
      transaction?.dataDecoded?.method ?? null,
      this.getActionCount(transaction),
      this.isCancellation(transaction, dataSize),
      humanDescription,
      richDecodedInfo,
    );
  }

  private getActionCount(
    transaction: MultisigTransaction | ModuleTransaction,
  ): number | null {
    const { dataDecoded } = transaction;
    if (dataDecoded?.method === MULTI_SEND_METHOD_NAME) {
      const parameter = dataDecoded.parameters?.find(
        (parameter) => parameter.name === TRANSACTIONS_PARAMETER_NAME,
      );
      return parameter?.valueDecoded?.length ?? null;
    }

    return null;
  }

  private isCancellation(
    transaction: MultisigTransaction | ModuleTransaction,
    dataSize: number,
  ): boolean {
    if (isMultisigTransaction(transaction)) {
      const {
        to,
        safe,
        value,
        baseGas,
        gasPrice,
        gasToken,
        operation,
        refundReceiver,
        safeTxGas,
      } = transaction;

      return (
        to === safe &&
        dataSize === 0 &&
        (!value || Number(value) === 0) &&
        operation === 0 &&
        (!baseGas || Number(baseGas) === 0) &&
        (!gasPrice || Number(gasPrice) === 0) &&
        (!gasToken || gasToken === NULL_ADDRESS) &&
        (!refundReceiver || refundReceiver === NULL_ADDRESS) &&
        (!safeTxGas || safeTxGas === 0)
      );
    } else {
      return false;
    }
  }
}
