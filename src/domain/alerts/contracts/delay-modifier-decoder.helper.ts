import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/domain/alerts/contracts/abi-decoder.helper';

const TRANSACTION_ADDED_ABI = parseAbi([
  'event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)',
]);

@Injectable()
export class DelayModifierDecoder extends AbiDecoder<
  typeof TRANSACTION_ADDED_ABI
> {
  constructor() {
    super(TRANSACTION_ADDED_ABI);
  }
}
