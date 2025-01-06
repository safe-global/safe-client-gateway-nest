import {
  KilnAbi,
  KilnDecoder,
} from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Injectable, Module } from '@nestjs/common';
import { getAbiItem, toFunctionSelector } from 'viem';

@Injectable()
export class KilnNativeStakingHelper {
  private static readonly DEPOSIT_SIGNATURE = getAbiItem({
    abi: KilnAbi,
    name: 'deposit',
  });
  private static readonly VALIDATORS_EXIT_SIGNATURE = getAbiItem({
    abi: KilnAbi,
    name: 'requestValidatorsExit',
  });
  private static readonly WITHDRAW_SIGNATURE = getAbiItem({
    abi: KilnAbi,
    name: 'batchWithdrawCLFee',
  });

  constructor(private readonly transactionFinder: TransactionFinder) {}

  public findDepositTransaction(args: {
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnNativeStakingHelper.DEPOSIT_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }

  public findValidatorsExitTransaction(args: {
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnNativeStakingHelper.VALIDATORS_EXIT_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }

  public findWithdrawTransaction(args: {
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnNativeStakingHelper.WITHDRAW_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }

  /**
   * Splits the public keys into an array of public keys.
   *
   * Each {@link KilnDecoder.KilnPublicKeyLength} characters represent a validator to withdraw, so the public keys
   * are split into an array of strings of length {@link KilnDecoder.KilnPublicKeyLength}.
   *
   * @param publicKeys - the public keys to split
   * @returns
   */
  public splitPublicKeys(publicKeys: `0x${string}`): Array<`0x${string}`> {
    // Remove initial `0x` of decoded `_publicKeys`
    const publicKeysString = publicKeys.slice(2);
    const publicKeysArray: Array<`0x${string}`> = [];
    for (
      let i = 0;
      i < publicKeysString.length;
      i += KilnDecoder.KilnPublicKeyLength
    ) {
      publicKeysArray.push(
        `0x${publicKeysString.slice(i, i + KilnDecoder.KilnPublicKeyLength)}`,
      );
    }
    return publicKeysArray;
  }
}

@Module({
  imports: [TransactionFinderModule],
  providers: [KilnNativeStakingHelper, KilnDecoder],
  exports: [KilnNativeStakingHelper, KilnDecoder],
})
export class KilnNativeStakingHelperModule {}
