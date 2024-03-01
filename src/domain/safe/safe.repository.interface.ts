import { Page } from '@/domain/entities/page.entity';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeList } from '@/domain/safe/entities/safe-list.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

export const ISafeRepository = Symbol('ISafeRepository');

export interface ISafeRepository {
  getSafe(args: { chainId: string; address: string }): Promise<Safe>;

  clearSafe(args: { chainId: string; address: string }): Promise<void>;

  isOwner(args: {
    chainId: string;
    safeAddress: string;
    address: string;
  }): Promise<boolean>;

  getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearTransfers(args: { chainId: string; safeAddress: string }): Promise<void>;

  getIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction>;

  getModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>>;

  clearModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  /**
   * Returns the Safe Transaction Queue in ascending order.
   *
   * The ascending order is first considered for the nonce.
   * If multiple transactions have the same nonce, then they
   * will be sorted according to the submission date
   */
  getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  /**
   * Returns the Safe Transaction Queue sorted by modified status.
   * (from most recently modified to last)
   */
  getTransactionQueueByModified(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  getCreationTransaction(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<CreationTransaction>;

  getTransactionHistory(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>>;

  getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction>;

  clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void>;

  clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  getMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  getTransfer(args: { chainId: string; transferId: string }): Promise<Transfer>;

  getTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
  }): Promise<Page<Transfer>>;

  getSafesByOwner(args: {
    chainId: string;
    ownerAddress: string;
  }): Promise<SafeList>;

  getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<MultisigTransaction | null>;

  proposeTransaction(args: {
    chainId: string;
    safeAddress: string;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown>;

  /**
   * Returns the nonce information for a Safe which includes its current nonce
   * and the recommended nonce for transaction execution.
   *
   * The recommended nonce is executed by getting the maximum between the
   * current Safe nonce and the last transaction nonce plus 1.
   * If there is no last transaction, the Safe nonce is returned.
   *
   * @returns the nonce state of the safe
   */
  getNonces(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ currentNonce: number; recommendedNonce: number }>;

  getSafesByModule(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<SafeList>;
}
