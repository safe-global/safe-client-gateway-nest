import { Inject, Injectable } from '@nestjs/common';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/decoders/proxy-factory-decoder.helper';
import {
  getSafeSingletonDeployments,
  getSafeL2SingletonDeployments,
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
} from '@/domain/common/utils/deployments';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import { UnofficialMasterCopyError } from '@/domain/relay/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/domain/relay/errors/unofficial-multisend.error';
import { InvalidTransferError } from '@/domain/relay/errors/invalid-transfer.error';
import { InvalidMultiSendError } from '@/domain/relay/errors/invalid-multisend.error';
import { UnofficialProxyFactoryError } from '@/domain/relay/errors/unofficial-proxy-factory.error';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';

@Injectable()
export class LimitAddressesMapper {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly erc20Decoder: Erc20Decoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly proxyFactoryDecoder: ProxyFactoryDecoder,
    private readonly delayModifierDecoder: DelayModifierDecoder,
  ) {}

  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<ReadonlyArray<`0x${string}`>> {
    const safeBeingRecovered = await this.getSafeBeingRecovered(args);
    if (safeBeingRecovered) {
      return [safeBeingRecovered];
    }

    // Calldata matches that of execTransaction and meets validity requirements
    if (
      this.isValidExecTransactionCall({
        to: args.to,
        data: args.data,
      })
    ) {
      // Safe attempting to relay is official
      const isOfficial = await this.isOfficialMastercopy({
        chainId: args.chainId,
        address: args.to,
      });

      if (!isOfficial) {
        throw new UnofficialMasterCopyError();
      }

      // Safe targeted by execTransaction will be limited
      return [args.to];
    }

    // Calldata matches that of multiSend and is from an official MultiSend contract
    if (this.multiSendDecoder.helpers.isMultiSend(args.data)) {
      if (
        !this.isOfficialMultiSendDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialMultiSendError();
      }

      // multiSend calldata meets the validity requirements
      const safeAddress = this.getSafeAddressFromMultiSend(args.data);

      // Safe attempting to relay is official
      const isOfficial = await this.isOfficialMastercopy({
        chainId: args.chainId,
        address: safeAddress,
      });

      if (!isOfficial) {
        throw new UnofficialMasterCopyError();
      }

      // Safe targeted in batch will be limited
      return [safeAddress];
    }

    // Calldata matches that of createProxyWithNonce and meets validity requirements
    if (
      this.isValidCreateProxyWithNonceCall({
        version: args.version,
        chainId: args.chainId,
        data: args.data,
      })
    ) {
      if (
        !this.isOfficialProxyFactoryDeployment({
          version: args.version,
          chainId: args.chainId,
          address: args.to,
        })
      ) {
        throw new UnofficialProxyFactoryError();
      }
      // Owners of safe-to-be-created will be limited
      return this.getOwnersFromCreateProxyWithNonce(args.data);
    }

    throw new InvalidTransferError();
  }

  /**
   * Returns the address of the Safe being recovered, if the recovery transaction is valid:
   *
   * - DelayModifier proposal (execTransactionFromModule) or execution (executeNextTx)
   * - (Batch) transaction(s) to add/remove/swap owners or change threshold on _a_ Safe
   * - Via an enabled module on said Safe
   *
   * @param {string} args.chainId - Chain ID
   * @param {string} args.version - Safe version
   * @param {string} args.to - Transaction recipient
   * @param {string} args.data - Transaction data
   *
   * @returns {string | null} - Safe address being recovered, if valid
   */
  private async getSafeBeingRecovered(args: {
    chainId: string;
    version: string;
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<`0x${string}` | null> {
    let to: `0x${string}`;
    let data: `0x${string}`;

    try {
      const decoded = this.delayModifierDecoder.decodeFunctionData({
        data: args.data,
      });

      if (
        // Proposal
        decoded.functionName !== 'execTransactionFromModule' &&
        // Execution
        decoded.functionName !== 'executeNextTx'
      ) {
        return null;
      }

      // No need to check value/operation as call is to Safe itself
      to = decoded.args[0];
      data = decoded.args[2];
    } catch {
      return null;
    }

    // (Batched) transaction(s) of transaction
    const transactions = this.decodeTransactions({
      address: to,
      version: args.version,
      chainId: args.chainId,
      data,
    });

    const isEveryTransactionOwnerManagement = transactions.every(
      (transaction) => {
        return this.isOwnerManagementTransaction(transaction.data);
      },
    );

    if (!isEveryTransactionOwnerManagement) {
      return null;
    }

    const { safes } = await this.safeRepository.getSafesByModule({
      chainId: args.chainId,
      moduleAddress: args.to,
    });

    // Module enabled on Safe, and batch transactions target the same Safe
    const isEnabledSafe = transactions.every((transaction, _, arr) => {
      return transaction.to === arr[0].to && safes.includes(transaction.to);
    });

    if (!isEnabledSafe) {
      return null;
    }

    return transactions[0].to;
  }

  /**
   * Maps batched transactions if the data of an official multiSend call
   * @param {string} args.address - Address of the recipient
   * @param {string} args.version - Safe version
   * @param {string} args.chainId - Chain ID
   * @param {string} args.data - Data of the transaction
   * @returns {Array<{ to: string; data: string }>} - Array of transactions
   */
  private decodeTransactions(args: {
    address: `0x${string}`;
    version: string;
    chainId: string;
    data: `0x${string}`;
  }): Array<{
    to: `0x${string}`;
    data: `0x${string}`;
  }> {
    if (
      this.isOfficialMultiSendDeployment(args) &&
      this.multiSendDecoder.helpers.isMultiSend(args.data)
    ) {
      return this.multiSendDecoder.mapMultiSendTransactions(args.data);
    }

    return [{ to: args.address, data: args.data }];
  }

  /**
   * Checks if the data of a transaction is an owner management transaction
   * @param {string} data - Data of the transaction
   * @returns {boolean} - Whether the data is of owner management
   */
  private isOwnerManagementTransaction(data: `0x${string}`): boolean {
    try {
      const decoded = this.safeDecoder.decodeFunctionData({
        data,
      });

      if (decoded.functionName !== 'execTransaction') {
        return false;
      }

      const execTransactionData = decoded.args[2];

      if (
        !this.safeDecoder.helpers.isAddOwnerWithThreshold(
          execTransactionData,
        ) &&
        !this.safeDecoder.helpers.isRemoveOwner(execTransactionData) &&
        !this.safeDecoder.helpers.isSwapOwner(execTransactionData) &&
        !this.safeDecoder.helpers.isChangeThreshold(execTransactionData)
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private isValidExecTransactionCall(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
    const execTransactionArgs = this.getExecTransactionArgs(args.data);
    // Not a valid execTransaction call
    if (!execTransactionArgs) {
      return false;
    }

    // Only ERC-20 transfer to other party is valid
    if (this.erc20Decoder.helpers.isTransfer(execTransactionArgs.data)) {
      return this.isValidErc20Transfer({
        to: args.to,
        data: execTransactionArgs.data,
      });
    }

    // Only ERC-20 transferFrom to other party is valid
    if (this.erc20Decoder.helpers.isTransferFrom(execTransactionArgs.data)) {
      return this.isValidErc20TransferFrom({
        to: args.to,
        data: execTransactionArgs.data,
      });
    }

    // Only transaction to other party is valid
    const toSelf = execTransactionArgs.to === args.to;
    if (!toSelf) {
      return true;
    }

    // Only transaction with no value is valid
    const hasValue = execTransactionArgs.value > BigInt(0);
    if (hasValue) {
      return false;
    }

    // Cancellations and Safe calls (e.g. owner management) are valid
    const isCancellation = execTransactionArgs.data === '0x';
    return isCancellation || this.safeDecoder.isCall(execTransactionArgs.data);
  }

  private getExecTransactionArgs(data: `0x${string}`): {
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
  } | null {
    try {
      const safeDecodedData = this.safeDecoder.decodeFunctionData({
        data,
      });

      if (safeDecodedData.functionName !== 'execTransaction') {
        return null;
      }

      return {
        to: safeDecodedData.args[0],
        value: safeDecodedData.args[1],
        data: safeDecodedData.args[2],
      };
    } catch {
      return null;
    }
  }

  private isValidErc20Transfer(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
    // Can throw but called after this.erc20Decoder.helpers.isTransfer
    const erc20DecodedData = this.erc20Decoder.decodeFunctionData({
      data: args.data,
    });

    if (erc20DecodedData.functionName !== 'transfer') {
      return false;
    }

    const [to] = erc20DecodedData.args;
    // to 'self' (the Safe) is not allowed
    return to !== args.to;
  }

  private isValidErc20TransferFrom(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
    // Can throw but called after this.erc20Decoder.helpers.isTransferFrom
    const erc20DecodedData = this.erc20Decoder.decodeFunctionData({
      data: args.data,
    });

    if (erc20DecodedData.functionName !== 'transferFrom') {
      return false;
    }

    const [sender, recipient] = erc20DecodedData.args;
    // to 'self' (the Safe) or from sender to sender as recipient is not allowed
    return sender !== recipient && recipient !== args.to;
  }

  private async isOfficialMastercopy(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<boolean> {
    try {
      await this.safeRepository.getSafe(args);
      return true;
    } catch {
      return false;
    }
  }

  private isOfficialMultiSendDeployment(args: {
    version: string;
    chainId: string;
    address: `0x${string}`;
  }): boolean {
    return (
      getMultiSendCallOnlyDeployments(args).includes(args.address) ||
      getMultiSendDeployments(args).includes(args.address)
    );
  }

  private getSafeAddressFromMultiSend = (
    data: `0x${string}`,
  ): `0x${string}` => {
    // Decode transactions within MultiSend
    const transactions = this.multiSendDecoder.mapMultiSendTransactions(data);

    // Every transaction is a valid execTransaction
    const isEveryValid = transactions.every((transaction) => {
      return this.isValidExecTransactionCall(transaction);
    });

    if (!isEveryValid) {
      throw new InvalidMultiSendError();
    }

    const firstRecipient = transactions[0].to;

    const isSameRecipient = transactions.every((transaction) => {
      return transaction.to === firstRecipient;
    });

    // Transactions calls execTransaction on varying addresses
    if (!isSameRecipient) {
      throw new InvalidMultiSendError();
    }

    return firstRecipient;
  };

  private isOfficialProxyFactoryDeployment(args: {
    version: string;
    chainId: string;
    address: `0x${string}`;
  }): boolean {
    const proxyFactoryDeployments = getProxyFactoryDeployments(args);
    return proxyFactoryDeployments.includes(args.address);
  }

  private isValidCreateProxyWithNonceCall(args: {
    version: string;
    chainId: string;
    data: `0x${string}`;
  }): boolean {
    let singleton: `0x${string}` | null = null;

    try {
      const decoded = this.proxyFactoryDecoder.decodeFunctionData({
        data: args.data,
      });

      if (decoded.functionName !== 'createProxyWithNonce') {
        return false;
      }

      singleton = decoded.args[0];
    } catch {
      return false;
    }

    return (
      getSafeSingletonDeployments(args).includes(singleton) ||
      getSafeL2SingletonDeployments(args).includes(singleton)
    );
  }

  private getOwnersFromCreateProxyWithNonce(
    data: `0x${string}`,
  ): ReadonlyArray<`0x${string}`> {
    const decodedProxyFactory = this.proxyFactoryDecoder.decodeFunctionData({
      data,
    });

    if (decodedProxyFactory.functionName !== 'createProxyWithNonce') {
      // Should never happen but check is needed to satisfy TypeScript
      throw Error('Not a createProxyWithNonce call');
    }

    const initializer = decodedProxyFactory.args[1];
    const decodedSafe = this.safeDecoder.decodeFunctionData({
      data: initializer,
    });

    if (decodedSafe.functionName !== 'setup') {
      // No custom error thrown, as caller subsequently throws InvalidTransferError
      throw Error('Not a setup call');
    }

    return decodedSafe.args[0];
  }
}
