import { Inject, Injectable } from '@nestjs/common';
import { max } from 'lodash';
import * as semver from 'semver';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { MasterCopy } from '@/domain/chains/entities/master-copies.entity';
import { MessagesRepository } from '@/domain/messages/messages.repository';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  MasterCopyVersionState,
  SafeState,
} from '@/routes/safes/entities/safe-info.entity';
import { SafeNonces } from '@/routes/safes/entities/nonces.entity';
import { Page } from '@/domain/entities/page.entity';

@Injectable()
export class SafesService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async getSafeInfo(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<SafeState> {
    const [safe, { recommendedMasterCopyVersion }, supportedMasterCopies] =
      await Promise.all([
        this.safeRepository.getSafe({
          chainId: args.chainId,
          address: args.safeAddress,
        }),
        this.chainsRepository.getChain(args.chainId),
        this.chainsRepository.getMasterCopies(args.chainId),
      ]);

    const versionState = this.computeVersionState(
      safe,
      recommendedMasterCopyVersion,
      supportedMasterCopies,
    );

    const [
      masterCopyInfo,
      fallbackHandlerInfo,
      guardInfo,
      collectiblesTag,
      queuedTransactionTag,
      transactionHistoryTag,
      messagesTag,
    ] = await Promise.all([
      this.addressInfoHelper.getOrDefault(args.chainId, safe.masterCopy, [
        'CONTRACT',
      ]),
      safe.fallbackHandler === NULL_ADDRESS
        ? Promise.resolve(null)
        : this.addressInfoHelper.getOrDefault(
            args.chainId,
            safe.fallbackHandler,
            ['CONTRACT'],
          ),
      safe.guard === NULL_ADDRESS
        ? Promise.resolve(null)
        : this.addressInfoHelper.getOrDefault(args.chainId, safe.guard, [
            'CONTRACT',
          ]),
      this.getCollectiblesTag(args.chainId, args.safeAddress),
      this.getQueuedTransactionTag(args.chainId, safe),
      this.getTxHistoryTagDate(args.chainId, args.safeAddress),
      this.modifiedMessageTag(args.chainId, args.safeAddress),
    ]);

    let moduleAddressesInfo: AddressInfo[] | null = null;
    if (safe.modules) {
      const moduleInfoCollection: Array<AddressInfo> =
        await this.addressInfoHelper.getCollection(args.chainId, safe.modules, [
          'CONTRACT',
        ]);
      moduleAddressesInfo =
        moduleInfoCollection.length == 0 ? null : moduleInfoCollection;
    }

    return new SafeState(
      new AddressInfo(safe.address),
      args.chainId,
      safe.nonce,
      safe.threshold,
      safe.owners.map((ownerAddress) => new AddressInfo(ownerAddress)),
      masterCopyInfo,
      versionState,
      this.toUnixTimestampInSecondsOrNow(collectiblesTag).toString(),
      this.toUnixTimestampInSecondsOrNow(queuedTransactionTag).toString(),
      this.toUnixTimestampInSecondsOrNow(transactionHistoryTag).toString(),
      this.toUnixTimestampInSecondsOrNow(messagesTag).toString(),
      moduleAddressesInfo,
      fallbackHandlerInfo,
      guardInfo,
      safe.version,
    );
  }

  public async getNonces(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<SafeNonces> {
    const nonce = await this.safeRepository.getNonces(args);
    return new SafeNonces(nonce);
  }

  private toUnixTimestampInSecondsOrNow(date: Date | null): number {
    const dateValue = date ? date.valueOf() : Date.now();
    return Math.floor(dateValue / 1000);
  }

  private async getCollectiblesTag(
    chainId: string,
    safeAddress: string,
  ): Promise<Date | null> {
    const lastCollectibleTransfer = await this.safeRepository
      .getCollectibleTransfers({
        chainId,
        safeAddress,
        limit: 1,
        offset: 0,
      })
      .catch(() => null);

    return lastCollectibleTransfer?.results[0]?.executionDate ?? null;
  }

  private async getQueuedTransactionTag(
    chainId: string,
    safe: Safe,
  ): Promise<Date | null> {
    const lastQueuedTransaction = await this.safeRepository
      .getTransactionQueueByModified({
        chainId,
        safe,
        limit: 1,
      })
      .catch(() => null);

    return lastQueuedTransaction?.results[0]?.modified ?? null;
  }

  /**
   * Gets the txHistoryTag date, i.e. the modification/submission/execution date for
   * the most recent transaction (multisig, module, transfer) associated to the {@link safeAddress}
   *
   * For multisig transactions, 'modified' (or 'submissionDate' if absent) is taken.
   * For module transactions and transfers, 'executionDate' is taken.
   *
   * @param chainId - chain id to use
   * @param safeAddress - the address of the target Safe
   * @returns {@link Date} the modification/submission/execution date for the most recent transaction
   */
  private async getTxHistoryTagDate(
    chainId: string,
    safeAddress: string,
  ): Promise<Date | null> {
    const txPages = await Promise.allSettled([
      this.safeRepository.getMultisigTransactions({
        chainId,
        safeAddress,
        limit: 1,
        executed: true,
      }),
      this.safeRepository.getModuleTransactions({
        chainId,
        safeAddress,
        limit: 1,
      }),
      this.safeRepository.getTransfers({
        chainId,
        safeAddress,
        limit: 1,
      }),
    ]);

    const dates = txPages
      .filter(
        (
          page,
        ): page is
          | PromiseFulfilledResult<Page<MultisigTransaction>>
          | PromiseFulfilledResult<Page<ModuleTransaction>>
          | PromiseFulfilledResult<Page<Transfer>> =>
          page.status === 'fulfilled',
      )
      .flatMap(
        ({ value }): (MultisigTransaction | ModuleTransaction | Transfer)[] =>
          value.results,
      )
      .map((tx) => {
        const isMultisig = 'safeTxHash' in tx && tx.safeTxHash !== undefined;
        return isMultisig ? tx.modified ?? tx.submissionDate : tx.executionDate;
      });

    return max(dates) ?? null;
  }

  private async modifiedMessageTag(
    chainId: string,
    safeAddress: string,
  ): Promise<Date | null> {
    const messages = await this.messagesRepository.getMessagesBySafe({
      chainId,
      safeAddress,
    });

    if (messages.results.length === 0) {
      return null;
    }

    const sortedMessages = messages.results.sort((m1, m2) => {
      return m2.modified.getTime() - m1.modified.getTime();
    });

    return sortedMessages[0].modified;
  }

  private computeVersionState(
    safe: Safe,
    recommendedSafeVersion: string,
    supportedMasterCopies: MasterCopy[],
  ): MasterCopyVersionState {
    // If the safe version is null we return UNKNOWN
    if (safe.version === null) return MasterCopyVersionState.UNKNOWN;
    // If the safe version or the recommended safe version is not valid we return UNKNOWN
    if (!semver.valid(safe.version)) return MasterCopyVersionState.UNKNOWN;
    if (!semver.valid(recommendedSafeVersion))
      return MasterCopyVersionState.UNKNOWN;
    // If the master copy of this safe is not part of the collection
    // of the supported master copies we return UNKNOWN
    if (
      !supportedMasterCopies
        .map((masterCopy) => masterCopy.address)
        .includes(safe.masterCopy)
    )
      return MasterCopyVersionState.UNKNOWN;

    // If the safe version is lower than the recommended safe version
    // we return it as outdated
    if (semver.lt(safe.version, recommendedSafeVersion))
      return MasterCopyVersionState.OUTDATED;

    // Else we consider that the safe is up-to-date
    return MasterCopyVersionState.UP_TO_DATE;
  }
}
