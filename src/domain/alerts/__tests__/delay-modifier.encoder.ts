import { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  Hex,
  parseAbi,
  parseAbiParameters,
} from 'viem';
import { Builder } from '@/__tests__/builder';

// TransactionAdded

type TransactionAddedEventArgs = {
  queueNonce: bigint;
  txHash: Hex;
  to: Hex;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
};

type TransactionAddedEvent = {
  data: Hex;
  topics: [signature: Hex, ...args: Array<Hex>];
};

class TransactionAddedEventBuilder<T extends TransactionAddedEventArgs>
  extends Builder<T>
  implements IEncoder<TransactionAddedEvent>
{
  static readonly NON_INDEXED_PARAMS =
    'address to, uint256 value, bytes data, uint8 operation' as const;
  static readonly EVENT_SIGNATURE =
    `event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, ${TransactionAddedEventBuilder.NON_INDEXED_PARAMS})` as const;

  encode(): TransactionAddedEvent {
    const abi = parseAbi([TransactionAddedEventBuilder.EVENT_SIGNATURE]);

    const args = this.build();

    const data = encodeAbiParameters(
      parseAbiParameters(TransactionAddedEventBuilder.NON_INDEXED_PARAMS),
      [args.to!, args.value!, args.data!, args.operation!],
    );

    const topics = encodeEventTopics({
      abi,
      eventName: 'TransactionAdded',
      args: {
        queueNonce: args.queueNonce!,
        txHash: args.txHash!,
      },
    }) as TransactionAddedEvent['topics'];

    return {
      data,
      topics,
    };
  }
}

export function transactionAddedEventBuilder(): TransactionAddedEventBuilder<TransactionAddedEventArgs> {
  return new TransactionAddedEventBuilder()
    .with('queueNonce', faker.number.bigInt())
    .with('txHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', BigInt(0))
    .with('data', '0x')
    .with('operation', 0);
}
