import { Inject, Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { CreationTransactionValidator } from '@/domain/safe/creation-transaction.validator';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeList } from '@/domain/safe/entities/safe-list.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { ModuleTransactionValidator } from '@/domain/safe/module-transaction.validator';
import { MultisigTransactionValidator } from '@/domain/safe/multisig-transaction.validator';
import { SafeListValidator } from '@/domain/safe/safe-list.validator';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { SafeValidator } from '@/domain/safe/safe.validator';
import { TransactionTypeValidator } from '@/domain/safe/transaction-type.validator';
import { TransferValidator } from '@/domain/safe/transfer.validator';
import { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { getAddress } from 'viem';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly multisigTransactionValidator: MultisigTransactionValidator,
    private readonly safeListValidator: SafeListValidator,
    private readonly safeValidator: SafeValidator,
    private readonly transactionTypeValidator: TransactionTypeValidator,
    private readonly transferValidator: TransferValidator,
    private readonly moduleTransactionValidator: ModuleTransactionValidator,
    private readonly creationTransactionValidator: CreationTransactionValidator,
  ) {}

  async getSafe(args: { chainId: string; address: string }): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const safe: Safe = await transactionService.getSafe(args.address);
    return this.safeValidator.validate(safe);
  }

  async clearSafe(args: { chainId: string; address: string }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.clearSafe(args.address);
  }

  async isOwner(args: {
    chainId: string;
    safeAddress: string;
    address: string;
  }): Promise<boolean> {
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    const owner = getAddress(args.address);
    const owners = safe.owners.map((rawAddress) => getAddress(rawAddress));
    return owners.includes(owner);
  }

  async getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    const page = await transactionService.getTransfers({
      ...args,
      onlyErc721: true,
    });
    return this.transferValidator.validatePage(page);
  }

  async clearTransfers(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearTransfers(args.safeAddress);
  }

  async getIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getIncomingTransfers(args);
    return this.transferValidator.validatePage(page);
  }

  async clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearIncomingTransfers(args.safeAddress);
  }

  async addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    await transactionService.postConfirmation(args);
  }

  async getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const moduleTransaction = await transactionService.getModuleTransaction(
      args.moduleTransactionId,
    );
    return this.moduleTransactionValidator.validate(moduleTransaction);
  }

  async getModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getModuleTransactions(args);
    return this.moduleTransactionValidator.validatePage(page);
  }

  async clearModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearModuleTransactions(args.safeAddress);
  }

  async getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
    trusted?: boolean;
  }): Promise<Page<MultisigTransaction>> {
    return this._getTransactionQueue({
      ...args,
      ordering: 'nonce,submissionDate',
    });
  }

  async getTransactionQueueByModified(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    return this._getTransactionQueue({
      ...args,
      ordering: '-modified',
    });
  }

  private async _getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    ordering: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page: Page<MultisigTransaction> =
      await transactionService.getMultisigTransactions({
        ...args,
        safeAddress: args.safe.address,
        executed: false,
        nonceGte: args.safe.nonce,
      });
    return this.multisigTransactionValidator.validatePage(page);
  }

  async getCreationTransaction(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<CreationTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const createTransaction = await transactionService.getCreationTransaction(
      args.safeAddress,
    );
    return this.creationTransactionValidator.validate(createTransaction);
  }

  async getTransactionHistory(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(args);
  }

  private async getAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: string;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page: Page<Transaction> = await transactionService.getAllTransactions(
      {
        ...args,
        executed: true,
        queued: false,
      },
    );
    return this.transactionTypeValidator.validatePage(page);
  }

  async clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.clearAllTransactions(args.safeAddress);
  }

  async clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.clearMultisigTransaction(
      args.safeTransactionHash,
    );
  }

  async getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const multiSigTransaction = await transactionService.getMultisigTransaction(
      args.safeTransactionHash,
    );

    return this.multisigTransactionValidator.validate(multiSigTransaction);
  }

  async deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.deleteTransaction(args);
  }

  async clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    return transactionService.clearMultisigTransactions(args.safeAddress);
  }

  async getMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getMultisigTransactions({
      ...args,
      ordering: '-nonce',
      trusted: true,
    });
    return this.multisigTransactionValidator.validatePage(page);
  }

  async getTransfer(args: {
    chainId: string;
    transferId: string;
  }): Promise<Transfer> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const transfer = await transactionService.getTransfer(args.transferId);
    return this.transferValidator.validate(transfer);
  }

  async getTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number | undefined;
  }): Promise<Page<Transfer>> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page = await transactionService.getTransfers(args);
    return this.transferValidator.validatePage(page);
  }

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: string;
  }): Promise<SafeList> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const safeList = await transactionService.getSafesByOwner(
      args.ownerAddress,
    );

    return this.safeListValidator.validate(safeList);
  }

  async getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<MultisigTransaction | null> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const page: Page<Transaction> =
      await transactionService.getMultisigTransactions({
        ...args,
        ordering: '-nonce',
        trusted: true,
        limit: 1,
      });

    return isEmpty(page.results)
      ? null
      : this.multisigTransactionValidator.validate(page.results[0]);
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: string;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);

    return transactionService.postMultisigTransaction({
      address: args.safeAddress,
      data: args.proposeTransactionDto,
    });
  }

  async getNonces(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ currentNonce: number; recommendedNonce: number }> {
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    const lastTransaction = await this.getLastTransactionSortedByNonce({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });

    const recommendedNonce = lastTransaction
      ? Math.max(safe.nonce, lastTransaction.nonce + 1)
      : safe.nonce;

    return {
      currentNonce: safe.nonce,
      recommendedNonce: recommendedNonce,
    };
  }

  async getSafesByModule(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<SafeList> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(args.chainId);
    const safesByModule = await transactionService.getSafesByModule(
      args.moduleAddress,
    );

    return this.safeListValidator.validate(safesByModule);
  }
}
