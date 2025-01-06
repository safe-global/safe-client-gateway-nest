import { Inject, Injectable } from '@nestjs/common';
import max from 'lodash/max';
import semver from 'semver';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
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
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { getNumberString } from '@/domain/common/utils/utils';
import { SafeOverview } from '@/routes/safes/entities/safe-overview.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { Caip10Addresses } from '@/routes/safes/entities/caip-10-addresses.entity';

@Injectable()
export class SafesService {
  private readonly maxOverviews: number;

  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: MessagesRepository,
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.maxOverviews = configurationService.getOrThrow(
      'mappings.safe.maxOverviews',
    );
  }

  async getSafeInfo(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<SafeState> {
    const [safe, { recommendedMasterCopyVersion }, supportedSingletons] =
      await Promise.all([
        this.safeRepository.getSafe({
          chainId: args.chainId,
          address: args.safeAddress,
        }),
        this.chainsRepository.getChain(args.chainId),
        this.chainsRepository.getSingletons(args.chainId),
      ]);

    const versionState = this.computeVersionState(
      safe,
      recommendedMasterCopyVersion,
      supportedSingletons,
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

    let moduleAddressesInfo: Array<AddressInfo> | null = null;
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
      this.toUnixTimestampInSecondsOrNull(collectiblesTag),
      this.toUnixTimestampInSecondsOrNull(queuedTransactionTag),
      this.toUnixTimestampInSecondsOrNull(transactionHistoryTag),
      this.toUnixTimestampInSecondsOrNull(messagesTag),
      moduleAddressesInfo,
      fallbackHandlerInfo,
      guardInfo,
      safe.version,
    );
  }

  async getSafeOverview(args: {
    currency: string;
    addresses: Caip10Addresses;
    trusted: boolean;
    excludeSpam: boolean;
    walletAddress?: `0x${string}`;
  }): Promise<Array<SafeOverview>> {
    const limitedSafes = args.addresses.slice(0, this.maxOverviews);

    const settledOverviews = await Promise.allSettled(
      limitedSafes.map(async ({ chainId, address }) => {
        const chain = await this.chainsRepository.getChain(chainId);
        const [safe, balances] = await Promise.all([
          this.safeRepository.getSafe({
            chainId,
            address,
          }),
          this.balancesRepository.getBalances({
            chain,
            safeAddress: address,
            trusted: args.trusted,
            fiatCode: args.currency,
            excludeSpam: args.excludeSpam,
          }),
        ]);
        const queue = await this.safeRepository.getTransactionQueue({
          chainId,
          safe,
        });

        const fiatBalance = balances
          .filter((b) => b.fiatBalance !== null)
          .reduce((acc, b) => acc + Number(b.fiatBalance), 0);

        const awaitingConfirmation = args.walletAddress
          ? this.computeAwaitingConfirmation({
              transactions: queue.results,
              walletAddress: args.walletAddress,
            })
          : null;

        return new SafeOverview(
          new AddressInfo(safe.address),
          chainId,
          safe.threshold,
          safe.owners.map((ownerAddress) => new AddressInfo(ownerAddress)),
          getNumberString(fiatBalance),
          queue.count ?? 0,
          awaitingConfirmation,
        );
      }),
    );

    const safeOverviews: Array<SafeOverview> = [];

    for (const safeOverview of settledOverviews) {
      if (safeOverview.status === 'rejected') {
        this.loggingService.warn(
          `Error while getting Safe overview: ${asError(safeOverview.reason)} `,
        );
      } else if (safeOverview.status === 'fulfilled') {
        safeOverviews.push(safeOverview.value);
      }
    }

    return safeOverviews;
  }

  public async getNonces(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<SafeNonces> {
    const nonce = await this.safeRepository.getNonces(args);
    return new SafeNonces(nonce);
  }

  private computeAwaitingConfirmation(args: {
    transactions: Array<MultisigTransaction>;
    walletAddress: `0x${string}`;
  }): number {
    return args.transactions.reduce(
      (acc, { confirmationsRequired, confirmations }) => {
        const isConfirmed =
          !!confirmations && confirmations.length >= confirmationsRequired;
        const isSignable =
          !isConfirmed &&
          !confirmations?.some((confirmation) => {
            return confirmation.owner === args.walletAddress;
          });
        if (isSignable) {
          acc++;
        }
        return acc;
      },
      0,
    );
  }

  private toUnixTimestampInSecondsOrNull(date: Date | null): string | null {
    return date ? Math.floor(date.valueOf() / 1000).toString() : null;
  }

  private async getCollectiblesTag(
    chainId: string,
    safeAddress: `0x${string}`,
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
    safeAddress: `0x${string}`,
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
        ({
          value,
        }): Array<MultisigTransaction | ModuleTransaction | Transfer> =>
          value.results,
      )
      .map((tx) => {
        const isMultisig = 'safeTxHash' in tx && tx.safeTxHash !== undefined;
        return isMultisig
          ? (tx.modified ?? tx.submissionDate)
          : tx.executionDate;
      });

    return max(dates) ?? null;
  }

  private async modifiedMessageTag(
    chainId: string,
    safeAddress: `0x${string}`,
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
    recommendedMasterCopyVersion: string,
    supportedSingletons: Array<Singleton>,
  ): MasterCopyVersionState {
    // If the safe version is null we return UNKNOWN
    if (safe.version === null) return MasterCopyVersionState.UNKNOWN;
    // If the safe version or the recommended safe version is not valid we return UNKNOWN
    if (!semver.valid(safe.version)) return MasterCopyVersionState.UNKNOWN;
    if (!semver.valid(recommendedMasterCopyVersion))
      return MasterCopyVersionState.UNKNOWN;
    // If the singleton of this safe is not part of the collection
    // of the supported singletons we return UNKNOWN
    if (
      supportedSingletons.every(
        (singleton) => singleton.address !== safe.masterCopy,
      )
    )
      return MasterCopyVersionState.UNKNOWN;

    // If the safe version is lower than the recommended safe version
    // we return it as outdated
    if (semver.lt(safe.version, recommendedMasterCopyVersion))
      return MasterCopyVersionState.OUTDATED;

    // Else we consider that the safe is up-to-date
    return MasterCopyVersionState.UP_TO_DATE;
  }
}
