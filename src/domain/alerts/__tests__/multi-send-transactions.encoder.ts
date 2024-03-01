import { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import {
  concat,
  encodeFunctionData,
  encodePacked,
  getAddress,
  Hex,
  parseAbi,
  size,
} from 'viem';
import { Builder } from '@/__tests__/builder';

// multiSend

type MultiSendArgs = {
  transactions: Hex;
};

class MultiSendEncoder<T extends MultiSendArgs>
  extends Builder<T>
  implements IEncoder
{
  static readonly FUNCTION_SIGNATURE =
    'function multiSend(bytes memory transactions)' as const;

  encode(): Hex {
    const abi = parseAbi([MultiSendEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'multiSend',
      args: [args.transactions],
    });
  }
}

export function multiSendTransactionsEncoder(
  transactions: Array<{
    operation: number;
    to: Hex;
    value: bigint;
    data: Hex;
  }>,
): Hex {
  const encodedTransactions = transactions.map(
    ({ operation, to, value, data }) => {
      return encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [operation, to, value, BigInt(size(data)), data],
      );
    },
  );

  return concat(encodedTransactions);
}

export function multiSendEncoder(): MultiSendEncoder<MultiSendArgs> {
  const transactions = multiSendTransactionsEncoder([
    {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x',
    },
  ]);

  return new MultiSendEncoder().with('transactions', transactions);
}
