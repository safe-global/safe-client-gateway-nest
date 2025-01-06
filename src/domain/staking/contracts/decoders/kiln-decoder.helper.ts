import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';

export const KilnAbi = parseAbi([
  'event DepositEvent(bytes pubkey, bytes withdrawal_credentials, bytes amount, bytes signature, bytes index)',
  'event Withdrawal(address indexed withdrawer, address indexed feeRecipient, bytes32 pubKeyRoot, uint256 rewards, uint256 nodeOperatorFee, uint256 treasuryFee)',
  'function deposit()',
  'function requestValidatorsExit(bytes _publicKeys)',
  'function batchWithdrawCLFee(bytes _publicKeys)',
]);

export type KilnRequestValidatorsExitParameters = {
  name: '_publicKeys';
  type: 'bytes';
  value: `0x${string}`;
  valueDecoded: null;
};
export type KilnBatchWithdrawCLFeeParameters =
  KilnRequestValidatorsExitParameters;

@Injectable()
export class KilnDecoder extends AbiDecoder<typeof KilnAbi> {
  public static readonly KilnPublicKeyLength = 96;
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(KilnAbi);
  }

  // TODO: When confirmation view endpoint is removed, remove this
  // and use this.helpers.isDeposit instead
  decodeDeposit(
    data: `0x${string}`,
  ): { method: string; parameters: [] } | null {
    if (!this.helpers.isDeposit(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'deposit') {
        throw new Error('Data is not of deposit type');
      }
      return {
        method: decoded.functionName,
        parameters: [],
      };
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  // TODO: When confirmation view endpoint is removed, return only
  // publicKeys and don't format it like DataDecoded
  decodeValidatorsExit(data: `0x${string}`): {
    method: string;
    parameters: Array<KilnRequestValidatorsExitParameters>;
  } | null {
    if (!this.helpers.isRequestValidatorsExit(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'requestValidatorsExit') {
        throw new Error('Data is not of requestValidatorsExit type');
      }
      return {
        method: decoded.functionName,
        parameters: [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: decoded.args[0],
            valueDecoded: null,
          },
        ],
      };
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  // TODO: When confirmation view endpoint is removed, return only
  // publicKeys and don't format it like DataDecoded
  decodeBatchWithdrawCLFee(data: `0x${string}`): {
    method: string;
    parameters: Array<KilnBatchWithdrawCLFeeParameters>;
  } | null {
    if (!this.helpers.isBatchWithdrawCLFee(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'batchWithdrawCLFee') {
        throw new Error('Data is not of batchWithdrawCLFee type');
      }
      return {
        method: decoded.functionName,
        parameters: [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: decoded.args[0],
            valueDecoded: null,
          },
        ],
      };
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeDepositEvent(args: {
    data: `0x${string}`;
    topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>];
  }): {
    pubkey: `0x${string}`;
    withdrawal_credentials: `0x${string}`;
    amount: `0x${string}`;
    signature: `0x${string}`;
    index: `0x${string}`;
  } | null {
    try {
      const decoded = this.decodeEventLog(args);
      if (decoded.eventName !== 'DepositEvent') {
        throw new Error('Data is not of DepositEvent type');
      }
      return decoded.args;
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeWithdrawal(args: {
    data: `0x${string}`;
    topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>];
  }): {
    withdrawer: `0x${string}`;
    feeRecipient: `0x${string}`;
    pubKeyRoot: `0x${string}`;
    rewards: bigint;
    nodeOperatorFee: bigint;
    treasuryFee: bigint;
  } | null {
    try {
      const decoded = this.decodeEventLog(args);
      if (decoded.eventName !== 'Withdrawal') {
        throw new Error('Data is not of Withdrawal type');
      }
      return decoded.args;
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }
}
