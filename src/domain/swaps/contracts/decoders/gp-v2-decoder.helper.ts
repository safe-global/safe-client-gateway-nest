import { Inject, Injectable, Module } from '@nestjs/common';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  BuyTokenBalance,
  OrderKind,
  SellTokenBalance,
} from '@/domain/swaps/entities/order.entity';

/**
 * Taken from CoW contracts:
 *
 * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/deployments/arbitrumOne/GPv2Settlement.json
 *
 * TODO: We should locate this in @/abis/... but we will need to refactor the /scripts/generate-abis.js
 * to handle ABIs that are present (or alternatively install the @cowprotocol/contracts package and generate
 * the ABIs from there)
 */
export const GPv2Abi = [
  {
    inputs: [
      {
        internalType: 'contract GPv2Authentication',
        name: 'authenticator_',
        type: 'address',
      },
      {
        internalType: 'contract IVault',
        name: 'vault_',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'target',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes4',
        name: 'selector',
        type: 'bytes4',
      },
    ],
    name: 'Interaction',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'orderUid',
        type: 'bytes',
      },
    ],
    name: 'OrderInvalidated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'orderUid',
        type: 'bytes',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'signed',
        type: 'bool',
      },
    ],
    name: 'PreSignature',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'solver',
        type: 'address',
      },
    ],
    name: 'Settlement',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'contract IERC20',
        name: 'sellToken',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'contract IERC20',
        name: 'buyToken',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'sellAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'buyAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'feeAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'orderUid',
        type: 'bytes',
      },
    ],
    name: 'Trade',
    type: 'event',
  },
  {
    inputs: [],
    name: 'authenticator',
    outputs: [
      {
        internalType: 'contract GPv2Authentication',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'domainSeparator',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    name: 'filledAmount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes[]',
        name: 'orderUids',
        type: 'bytes[]',
      },
    ],
    name: 'freeFilledAmountStorage',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes[]',
        name: 'orderUids',
        type: 'bytes[]',
      },
    ],
    name: 'freePreSignatureStorage',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'offset',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'length',
        type: 'uint256',
      },
    ],
    name: 'getStorageAt',
    outputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'orderUid',
        type: 'bytes',
      },
    ],
    name: 'invalidateOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    name: 'preSignature',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'orderUid',
        type: 'bytes',
      },
      {
        internalType: 'bool',
        name: 'signed',
        type: 'bool',
      },
    ],
    name: 'setPreSignature',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IERC20[]',
        name: 'tokens',
        type: 'address[]',
      },
      {
        internalType: 'uint256[]',
        name: 'clearingPrices',
        type: 'uint256[]',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'sellTokenIndex',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'buyTokenIndex',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'sellAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'buyAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint32',
            name: 'validTo',
            type: 'uint32',
          },
          {
            internalType: 'bytes32',
            name: 'appData',
            type: 'bytes32',
          },
          {
            internalType: 'uint256',
            name: 'feeAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'flags',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'executedAmount',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'signature',
            type: 'bytes',
          },
        ],
        internalType: 'struct GPv2Trade.Data[]',
        name: 'trades',
        type: 'tuple[]',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'target',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'callData',
            type: 'bytes',
          },
        ],
        internalType: 'struct GPv2Interaction.Data[][3]',
        name: 'interactions',
        type: 'tuple[][3]',
      },
    ],
    name: 'settle',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'targetContract',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'calldataPayload',
        type: 'bytes',
      },
    ],
    name: 'simulateDelegatecall',
    outputs: [
      {
        internalType: 'bytes',
        name: 'response',
        type: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'targetContract',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'calldataPayload',
        type: 'bytes',
      },
    ],
    name: 'simulateDelegatecallInternal',
    outputs: [
      {
        internalType: 'bytes',
        name: 'response',
        type: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bytes32',
            name: 'poolId',
            type: 'bytes32',
          },
          {
            internalType: 'uint256',
            name: 'assetInIndex',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'assetOutIndex',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'userData',
            type: 'bytes',
          },
        ],
        internalType: 'struct IVault.BatchSwapStep[]',
        name: 'swaps',
        type: 'tuple[]',
      },
      {
        internalType: 'contract IERC20[]',
        name: 'tokens',
        type: 'address[]',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'sellTokenIndex',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'buyTokenIndex',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'receiver',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'sellAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'buyAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint32',
            name: 'validTo',
            type: 'uint32',
          },
          {
            internalType: 'bytes32',
            name: 'appData',
            type: 'bytes32',
          },
          {
            internalType: 'uint256',
            name: 'feeAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'flags',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'executedAmount',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'signature',
            type: 'bytes',
          },
        ],
        internalType: 'struct GPv2Trade.Data',
        name: 'trade',
        type: 'tuple',
      },
    ],
    name: 'swap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'vault',
    outputs: [
      {
        internalType: 'contract IVault',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'vaultRelayer',
    outputs: [
      {
        internalType: 'contract GPv2VaultRelayer',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
  },
] as const;

export type GPv2OrderParameters = {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  receiver: `0x${string}`;
  sellAmount: bigint;
  buyAmount: bigint;
  validTo: number;
  appData: `0x${string}`;
  feeAmount: bigint;
  kind: OrderKind;
  partiallyFillable: boolean;
  sellTokenBalance: SellTokenBalance;
  buyTokenBalance: BuyTokenBalance;
};

/**
 * Decoder for GPv2Settlement contract.
 *
 * The following is based on the CoW SDK implementation:
 * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/src/ts/settlement.ts
 */
@Injectable()
export class GPv2Decoder extends AbiDecoder<typeof GPv2Abi> {
  private static readonly FlagMasks = {
    kind: {
      offset: 0,
      options: [OrderKind.Sell, OrderKind.Buy],
    },
    partiallyFillable: {
      offset: 1,
      options: [false, true],
    },
    sellTokenBalance: {
      offset: 2,
      options: [
        SellTokenBalance.Erc20,
        undefined, // unused
        SellTokenBalance.External,
        SellTokenBalance.Internal,
      ],
    },
    buyTokenBalance: {
      offset: 4,
      options: [BuyTokenBalance.Erc20, BuyTokenBalance.Internal],
    },
  } as const;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(GPv2Abi);
  }

  /**
   * Gets the Order UID associated with the provided transaction data.
   *
   * @param data - the transaction data for the setPreSignature call
   * @returns {`0x${string}`} the order UID or null if the data does not represent a setPreSignature transaction
   */
  public getOrderUidFromSetPreSignature(
    data: `0x${string}`,
  ): `0x${string}` | null {
    if (!this.helpers.isSetPreSignature(data)) {
      return null;
    }

    try {
      const decoded = this.decodeFunctionData({ data });

      if (decoded.functionName !== 'setPreSignature') {
        throw new Error('Data is not of setPreSignature');
      }

      return decoded.args[0];
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  /**
   * Decodes an order from a settlement trade.
   *
   * @param trade The trade to decode into an order.
   * @param tokens The list of token addresses as they appear in the settlement.
   * @returns The decoded {@link GPv2OrderParameters} or null if the trade is invalid.
   */
  public decodeOrderFromSettle(
    data: `0x${string}`,
  ): GPv2OrderParameters | null {
    const decoded = this.decodeSettle(data);

    if (!decoded) {
      return null;
    }

    const [tokens, , [trade]] = decoded;

    const sellTokenIndex = Number(trade.sellTokenIndex);
    const buyTokenIndex = Number(trade.buyTokenIndex);

    if (Math.max(sellTokenIndex, buyTokenIndex) >= tokens.length) {
      throw new Error('Invalid trade');
    }

    return {
      sellToken: tokens[sellTokenIndex],
      buyToken: tokens[buyTokenIndex],
      receiver: trade.receiver,
      sellAmount: trade.sellAmount,
      buyAmount: trade.buyAmount,
      validTo: trade.validTo,
      appData: trade.appData,
      feeAmount: trade.feeAmount,
      kind: this.decodeFlag('kind', trade.flags),
      partiallyFillable: this.decodeFlag('partiallyFillable', trade.flags),
      sellTokenBalance: this.decodeFlag('sellTokenBalance', trade.flags),
      buyTokenBalance: this.decodeFlag('buyTokenBalance', trade.flags),
    };
  }

  // Use inferred return type
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private decodeSettle(data: `0x${string}`) {
    if (!this.helpers.isSettle(data)) {
      return null;
    }

    try {
      const decoded = this.decodeFunctionData({ data });

      if (decoded.functionName !== 'settle') {
        throw new Error('Data is not of settle');
      }

      return decoded.args;
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  /**
   * Decodes the specified bitfield flag.
   *
   * The following is taken from the CoW contracts:
   * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/src/ts/settlement.ts#L213
   *
   * @param key - encoded key
   * @param flag - order flag encoded as a bitfield
   * @returns decoded key
   */
  private decodeFlag<K extends keyof typeof GPv2Decoder.FlagMasks>(
    key: K,
    flag: bigint,
  ): Exclude<(typeof GPv2Decoder.FlagMasks)[K]['options'][number], undefined> {
    const { offset, options } = GPv2Decoder.FlagMasks[key];
    const numberFlags = Number(flag);
    const index = (numberFlags >> offset) & this.mask(options);

    const decoded = options[index] as Exclude<
      (typeof GPv2Decoder.FlagMasks)[K]['options'][number],
      undefined
    >;

    if (decoded === undefined || index < 0) {
      throw new Error(
        `Invalid input flag for ${key}: 0b${numberFlags.toString(2)}`,
      );
    }

    return decoded;
  }

  // Counts smallest mask needed to store input options in masked bitfield
  private mask(options: ReadonlyArray<unknown>): number {
    const num = options.length;
    const bitCount = 32 - Math.clz32(num - 1);
    return (1 << bitCount) - 1;
  }
}

@Module({
  providers: [GPv2Decoder],
  exports: [GPv2Decoder],
})
export class GPv2DecoderModule {}
