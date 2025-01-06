import { Inject, Injectable } from '@nestjs/common';
import isEmpty from 'lodash/isEmpty';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeList } from '@/domain/safe/entities/safe-list.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import {
  Transfer,
  TransferPageSchema,
  TransferSchema,
} from '@/domain/safe/entities/transfer.entity';
import {
  ModuleTransactionPageSchema,
  ModuleTransactionSchema,
} from '@/domain/safe/entities/module-transaction.entity';
import {
  MultisigTransactionPageSchema,
  MultisigTransactionSchema,
} from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeListSchema } from '@/domain/safe/entities/schemas/safe-list.schema';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { TransactionTypePageSchema } from '@/domain/safe/entities/schemas/transaction-type.schema';
import { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { CreationTransactionSchema } from '@/domain/safe/entities/schemas/creation-transaction.schema';
import { SafeSchema } from '@/domain/safe/entities/schemas/safe.schema';
import { z } from 'zod';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<Safe> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safe = await transactionService.getSafe(args.address);
    return SafeSchema.parse(safe);
  }

  async isSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<boolean> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const isSafe = await transactionService.isSafe(args.address);
    return z.boolean().parse(isSafe);
  }

  async clearIsSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearIsSafe(args.address);
  }

  async clearSafe(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearSafe(args.address);
  }

  async isOwner(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    address: `0x${string}`;
  }): Promise<boolean> {
    const safe = await this.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });
    return safe.owners.includes(args.address);
  }

  async getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    const page = await transactionService.getTransfers({
      ...args,
      onlyErc721: true,
    });
    return TransferPageSchema.parse(page);
  }

  async clearTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearTransfers(args.safeAddress);
  }

  async getIncomingTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    tokenAddress?: `0x${string}`;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getIncomingTransfers(args);
    return TransferPageSchema.parse(page);
  }

  async clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearIncomingTransfers(args.safeAddress);
  }

  async addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    await transactionService.postConfirmation(args);
  }

  async getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const moduleTransaction = await transactionService.getModuleTransaction(
      args.moduleTransactionId,
    );
    return ModuleTransactionSchema.parse(moduleTransaction);
  }

  async getModuleTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getModuleTransactions(args);
    return ModuleTransactionPageSchema.parse(page);
  }

  async clearModuleTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

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
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getMultisigTransactions({
      ...args,
      safeAddress: args.safe.address,
      executed: false,
      nonceGte: args.safe.nonce,
    });
    return MultisigTransactionPageSchema.parse(page);
  }

  async getCreationTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<CreationTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const createTransaction = await transactionService.getCreationTransaction(
      args.safeAddress,
    );
    return CreationTransactionSchema.parse(createTransaction);
  }

  async getTransactionHistory(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    return this.getAllExecutedTransactions(args);
  }

  private async getAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    ordering?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getAllTransactions({
      ...args,
      executed: true,
      queued: false,
    });
    return TransactionTypePageSchema.parse(page);
  }

  async clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.clearAllTransactions(args.safeAddress);
  }

  async clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearMultisigTransaction(
      args.safeTransactionHash,
    );
  }

  async getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const multiSigTransaction = await transactionService.getMultisigTransaction(
      args.safeTransactionHash,
    );

    return MultisigTransactionSchema.parse(multiSigTransaction);
  }

  async deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const transaction = await transactionService.getMultisigTransaction(
      args.safeTxHash,
    );
    const { safe } = MultisigTransactionSchema.parse(transaction);
    await transactionService.deleteTransaction(args);

    // Ensure transaction is removed from cache in case event is not received
    Promise.all([
      transactionService.clearMultisigTransaction(args.safeTxHash),
      transactionService.clearMultisigTransactions(safe),
    ]).catch(() => {
      this.loggingService.warn(
        'Failed to immediately clear deleted transaction from cache',
      );
    });
  }

  async clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    return transactionService.clearMultisigTransactions(args.safeAddress);
  }

  async getMultisigTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getMultisigTransactions({
      ...args,
      ordering: '-nonce',
      trusted: true,
    });
    return MultisigTransactionPageSchema.parse(page);
  }

  async getTransfer(args: {
    chainId: string;
    transferId: string;
  }): Promise<Transfer> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const transfer = await transactionService.getTransfer(args.transferId);
    return TransferSchema.parse(transfer);
  }

  async getTransfers(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number | undefined;
  }): Promise<Page<Transfer>> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getTransfers(args);
    return TransferPageSchema.parse(page);
  }

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: `0x${string}`;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safeList = await transactionService.getSafesByOwner(
      args.ownerAddress,
    );

    return SafeListSchema.parse(safeList);
  }

  async getAllSafesByOwner(args: {
    ownerAddress: `0x${string}`;
  }): Promise<{ [chainId: string]: Array<string> }> {
    const chains = await this.chainsRepository.getAllChains();
    const allSafeLists = await Promise.all(
      chains.map(async ({ chainId }) => {
        const safeList = await this.getSafesByOwner({
          chainId,
          ownerAddress: args.ownerAddress,
        });

        return {
          chainId,
          safeList,
        };
      }),
    );

    return allSafeLists.reduce((acc, { chainId, safeList }) => {
      return {
        ...acc,
        [chainId]: safeList.safes,
      };
    }, {});
  }

  async getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<MultisigTransaction | null> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const page = await transactionService.getMultisigTransactions({
      ...args,
      ordering: '-nonce',
      trusted: true,
      limit: 1,
    });
    const { results } = MultisigTransactionPageSchema.parse(page);

    return isEmpty(results)
      ? null
      : MultisigTransactionSchema.parse(results[0]);
  }

  async proposeTransaction(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );

    return transactionService.postMultisigTransaction({
      address: args.safeAddress,
      data: args.proposeTransactionDto,
    });
  }

  async getNonces(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
    moduleAddress: `0x${string}`;
  }): Promise<SafeList> {
    const transactionService = await this.transactionApiManager.getApi(
      args.chainId,
    );
    const safesByModule = await transactionService.getSafesByModule(
      args.moduleAddress,
    );

    return SafeListSchema.parse(safesByModule);
  }
}
