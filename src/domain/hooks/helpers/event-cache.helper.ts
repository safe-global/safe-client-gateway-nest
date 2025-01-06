import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { IBlockchainRepository } from '@/domain/blockchain/blockchain.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { ITransactionsRepository } from '@/domain/transactions/transactions.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  ConfigEventType,
  TransactionEventType,
} from '@/routes/hooks/entities/event-type.entity';
import { Event } from '@/routes/hooks/entities/event.entity';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import memoize from 'lodash/memoize';
import type { MemoizedFunction } from 'lodash';

@Injectable()
export class EventCacheHelper {
  private static readonly HOOK_TYPE = 'hook';
  private static readonly UNSUPPORTED_CHAIN_EVENT = 'unsupported_chain_event';
  public isSupportedChainMemo: ((chainId: string) => Promise<boolean>) &
    MemoizedFunction;
  private unsupportedChains: Array<string> = [];

  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IBlockchainRepository)
    private readonly blockchainRepository: IBlockchainRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(ICollectiblesRepository)
    private readonly collectiblesRepository: ICollectiblesRepository,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesRepository: IDelegatesV2Repository,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: IMessagesRepository,
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: ISafeAppsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(ITransactionsRepository)
    private readonly transactionsRepository: ITransactionsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
  ) {
    this.isSupportedChainMemo = memoize(
      this.chainsRepository.isSupportedChain.bind(this.chainsRepository),
    );
  }

  // TODO: Split service into multiple classes, each handling Config/Transactions events
  private readonly EventTypeHandler: {
    [Type in Event['type']]: (
      event: Extract<Event, { type: Type }>,
    ) => Array<Promise<void>>;
  } = {
    [TransactionEventType.PENDING_MULTISIG_TRANSACTION]:
      this.onTransactionEventPendingMultisigTransaction.bind(this),
    [TransactionEventType.DELETED_MULTISIG_TRANSACTION]:
      this.onTransactionEventDeletedMultisigTransaction.bind(this),
    [TransactionEventType.MODULE_TRANSACTION]:
      this.onTransactionEventModuleTransaction.bind(this),
    [TransactionEventType.EXECUTED_MULTISIG_TRANSACTION]:
      this.onTransactionEventExecutedMultisigTransaction.bind(this),
    [TransactionEventType.NEW_CONFIRMATION]:
      this.onTransactionEventNewConfirmation.bind(this),
    [TransactionEventType.INCOMING_ETHER]:
      this.onTransactionEventIncomingEther.bind(this),
    [TransactionEventType.OUTGOING_ETHER]:
      this.onTransactionEventOutgoingEther.bind(this),
    [TransactionEventType.INCOMING_TOKEN]:
      this.onTransactionEventIncomingToken.bind(this),
    [TransactionEventType.OUTGOING_TOKEN]:
      this.onTransactionEventOutgoingToken.bind(this),
    [TransactionEventType.MESSAGE_CREATED]:
      this.onTransactionEventMessageCreated.bind(this),
    [TransactionEventType.MESSAGE_CONFIRMATION]:
      this.onTransactionEventMessageConfirmation.bind(this),
    [TransactionEventType.REORG_DETECTED]: () => [],
    [TransactionEventType.SAFE_CREATED]:
      this.onTransactionEventSafeCreated.bind(this),
    [TransactionEventType.NEW_DELEGATE]:
      this.onTransactionEventDelegate.bind(this),
    [TransactionEventType.DELETED_DELEGATE]:
      this.onTransactionEventDelegate.bind(this),
    [TransactionEventType.UPDATED_DELEGATE]:
      this.onTransactionEventDelegate.bind(this),
    [ConfigEventType.CHAIN_UPDATE]: this.onConfigEventChainUpdate.bind(this),
    [ConfigEventType.SAFE_APPS_UPDATE]:
      this.onConfigEventSafeAppsUpdate.bind(this),
  };

  public async onEventClearCache<
    E extends Extract<Event, { type: Event['type'] }>,
  >(event: E): Promise<Array<void>> {
    const eventHandler = this.EventTypeHandler[event.type] as (
      event: E,
    ) => Array<Promise<void>>;
    return Promise.all(eventHandler(event));
  }

  public onEventLog(event: Event): void {
    switch (event.type) {
      case TransactionEventType.PENDING_MULTISIG_TRANSACTION:
      case TransactionEventType.DELETED_MULTISIG_TRANSACTION:
      case TransactionEventType.EXECUTED_MULTISIG_TRANSACTION:
      case TransactionEventType.NEW_CONFIRMATION:
        this._logSafeTxEvent(event);
        break;
      case TransactionEventType.MODULE_TRANSACTION:
      case TransactionEventType.INCOMING_ETHER:
      case TransactionEventType.OUTGOING_ETHER:
      case TransactionEventType.INCOMING_TOKEN:
      case TransactionEventType.OUTGOING_TOKEN:
        this._logTxEvent(event);
        break;
      case TransactionEventType.MESSAGE_CREATED:
      case TransactionEventType.MESSAGE_CONFIRMATION:
        this._logMessageEvent(event);
        break;
      case TransactionEventType.NEW_DELEGATE:
      case TransactionEventType.UPDATED_DELEGATE:
      case TransactionEventType.DELETED_DELEGATE:
      case ConfigEventType.CHAIN_UPDATE:
      case ConfigEventType.SAFE_APPS_UPDATE:
        this._logEvent(event);
        break;
      case TransactionEventType.REORG_DETECTED:
      case TransactionEventType.SAFE_CREATED:
        break;
    }
  }

  /**
   * Increases the counter of unsupported chain events for the given chain.
   * @param event {@link Event} object
   */
  public async onUnsupportedChainEvent(event: Event): Promise<void> {
    if (!this.unsupportedChains.includes(event.chainId)) {
      this.unsupportedChains.push(event.chainId);
    }
    const cacheKey = CacheRouter.getUnsupportedChainEventCacheKey(
      event.chainId,
    );
    await this.cacheService.increment(cacheKey, MAX_TTL);
  }

  /**
   * Logs the number of unsupported chain events for each chain and clears the store.
   * This function is public just for testing purposes.
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    disabled: process.env.NODE_ENV === 'test',
  })
  public async logUnsupportedEvents(): Promise<void> {
    await Promise.all(
      this.unsupportedChains.map(async (chainId) => {
        const cacheKey = CacheRouter.getUnsupportedChainEventCacheKey(chainId);
        const count = await this.cacheService.getCounter(cacheKey);
        if (count) {
          this.loggingService.warn({
            type: EventCacheHelper.UNSUPPORTED_CHAIN_EVENT,
            chainId,
            count,
          });
          await this.cacheService.deleteByKey(cacheKey);
        }
      }),
    );
    this.unsupportedChains = [];
  }

  // Transaction Service events

  private onTransactionEventPendingMultisigTransaction(
    event: Extract<
      Event,
      { type: TransactionEventType.PENDING_MULTISIG_TRANSACTION }
    >,
  ): Array<Promise<void>> {
    // A new pending multisig transaction affects:
    // queued transactions – clear multisig transactions
    // the pending transaction – clear multisig transaction
    return [
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
    ];
  }

  private onTransactionEventDeletedMultisigTransaction(
    event: Extract<
      Event,
      { type: TransactionEventType.DELETED_MULTISIG_TRANSACTION }
    >,
  ): Array<Promise<void>> {
    // A deleted multisig transaction affects:
    // queued transactions – clear multisig transactions
    // the pending transaction – clear multisig transaction
    return [
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
    ];
  }

  private onTransactionEventModuleTransaction(
    event: Extract<Event, { type: TransactionEventType.MODULE_TRANSACTION }>,
  ): Array<Promise<void>> {
    // An executed module transaction might affect:
    // - the list of all executed transactions for the safe
    // - the stakes of a safe
    // - the list of module transactions for the safe
    // - the safe configuration
    return [
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.stakingRepository.clearStakes({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearModuleTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearSafe({
        chainId: event.chainId,
        address: event.address,
      }),
    ];
  }

  private onTransactionEventExecutedMultisigTransaction(
    event: Extract<
      Event,
      { type: TransactionEventType.EXECUTED_MULTISIG_TRANSACTION }
    >,
  ): Array<Promise<void>> {
    // A new executed multisig transaction affects:
    // - the collectibles that the safe has
    // - the list of all executed transactions for the safe
    // - the transfers for that safe
    // - queued transactions and history – clear multisig transactions
    // - the transaction executed – clear multisig transaction
    // - the safe configuration - clear safe info
    // - the stakes of a safe
    return [
      this.collectiblesRepository.clearCollectibles({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
      this.safeRepository.clearSafe({
        chainId: event.chainId,
        address: event.address,
      }),
      this.stakingRepository.clearStakes({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventNewConfirmation(
    event: Extract<Event, { type: TransactionEventType.NEW_CONFIRMATION }>,
  ): Array<Promise<void>> {
    // A new confirmation for a pending transaction affects:
    // - queued transactions – clear multisig transactions
    // - the pending transaction – clear multisig transaction
    return [
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
    ];
  }

  private onTransactionEventIncomingEther(
    event: Extract<Event, { type: TransactionEventType.INCOMING_ETHER }>,
  ): Array<Promise<void>> {
    // Incoming ether affects:
    // - the balance of the safe - clear safe balance
    // - the list of all executed transactions (including transfers) for the safe
    // - the incoming transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventOutgoingEther(
    event: Extract<Event, { type: TransactionEventType.OUTGOING_ETHER }>,
  ): Array<Promise<void>> {
    // Outgoing ether affects:
    // - the balance of the safe - clear safe balance
    // - the list of all executed transactions for the safe
    // - queued transactions and history – clear multisig transactions
    // - the transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventIncomingToken(
    event: Extract<Event, { type: TransactionEventType.INCOMING_TOKEN }>,
  ): Array<Promise<void>> {
    // An incoming token affects:
    // - the balance of the safe - clear safe balance
    // - the collectibles that the safe has
    // - the list of all executed transactions (including transfers) for the safe
    // - queued transactions and history – clear multisig transactions
    // - the transfers for that safe
    // - the incoming transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.collectiblesRepository.clearCollectibles({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventOutgoingToken(
    event: Extract<Event, { type: TransactionEventType.OUTGOING_TOKEN }>,
  ): Array<Promise<void>> {
    // An outgoing token affects:
    // - the balance of the safe - clear safe balance
    // - the collectibles that the safe has
    // - the list of all executed transactions (including transfers) for the safe
    // - queued transactions and history – clear multisig transactions
    // - the transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.collectiblesRepository.clearCollectibles({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventMessageCreated(
    event: Extract<Event, { type: TransactionEventType.MESSAGE_CREATED }>,
  ): Array<Promise<void>> {
    // A message created affects:
    // - the messages associated to the Safe
    return [
      this.messagesRepository.clearMessagesBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventMessageConfirmation(
    event: Extract<Event, { type: TransactionEventType.MESSAGE_CONFIRMATION }>,
  ): Array<Promise<void>> {
    // A new message confirmation affects:
    // - the message itself
    // - the messages associated to the Safe
    return [
      this.messagesRepository.clearMessagesByHash({
        chainId: event.chainId,
        messageHash: event.messageHash,
      }),
      this.messagesRepository.clearMessagesBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  // Config Service events

  private onConfigEventChainUpdate(
    event: Extract<Event, { type: ConfigEventType.CHAIN_UPDATE }>,
  ): Array<Promise<void>> {
    // As the chains have been updated, we need to clear the memoized function cache.
    if (this.isSupportedChainMemo.cache.clear) {
      this.isSupportedChainMemo.cache.clear();
      // Remove the chain from the unsupported chains list
      this.unsupportedChains = this.unsupportedChains.filter(
        (unsupportedChain) => unsupportedChain !== event.chainId,
      );
    }
    return [
      this.chainsRepository.clearChain(event.chainId).then(() => {
        // RPC may have changed
        this.blockchainRepository.clearApi(event.chainId);
        // Testnet status may have changed
        this.stakingRepository.clearApi(event.chainId);
        // Transaction Service may have changed
        this.transactionsRepository.clearApi(event.chainId);
        this.balancesRepository.clearApi(event.chainId);
      }),
    ];
  }

  private onConfigEventSafeAppsUpdate(
    event: Extract<Event, { type: ConfigEventType.SAFE_APPS_UPDATE }>,
  ): Array<Promise<void>> {
    return [this.safeAppsRepository.clearSafeApps(event.chainId)];
  }

  private onTransactionEventSafeCreated(
    event: Extract<Event, { type: TransactionEventType.SAFE_CREATED }>,
  ): Array<Promise<void>> {
    return [this.safeRepository.clearIsSafe(event)];
  }

  private onTransactionEventDelegate(
    event: Extract<
      Event,
      {
        type:
          | TransactionEventType.NEW_DELEGATE
          | TransactionEventType.UPDATED_DELEGATE
          | TransactionEventType.DELETED_DELEGATE;
      }
    >,
  ): Array<Promise<void>> {
    // A delegate change affects:
    // - the delegates associated to the Safe
    return [
      this.delegatesRepository.clearDelegates({
        chainId: event.chainId,
        safeAddress: event.address ?? undefined,
      }),
    ];
  }

  private _logSafeTxEvent(
    event: Extract<
      Event,
      {
        type:
          | TransactionEventType.PENDING_MULTISIG_TRANSACTION
          | TransactionEventType.DELETED_MULTISIG_TRANSACTION
          | TransactionEventType.EXECUTED_MULTISIG_TRANSACTION
          | TransactionEventType.NEW_CONFIRMATION;
      }
    >,
  ): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      event_type: event.type,
      address: event.address,
      chain_id: event.chainId,
      safe_tx_hash: event.safeTxHash,
    });
  }

  private _logTxEvent(
    event: Extract<
      Event,
      {
        type:
          | TransactionEventType.MODULE_TRANSACTION
          | TransactionEventType.INCOMING_ETHER
          | TransactionEventType.OUTGOING_ETHER
          | TransactionEventType.INCOMING_TOKEN
          | TransactionEventType.OUTGOING_TOKEN;
      }
    >,
  ): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      event_type: event.type,
      address: event.address,
      chain_id: event.chainId,
      tx_hash: event.txHash,
    });
  }

  private _logMessageEvent(
    event: Extract<
      Event,
      {
        type:
          | TransactionEventType.MESSAGE_CREATED
          | TransactionEventType.MESSAGE_CONFIRMATION;
      }
    >,
  ): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      event_type: event.type,
      address: event.address,
      chain_id: event.chainId,
      message_hash: event.messageHash,
    });
  }

  private _logEvent(event: Event): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      event_type: event.type,
      chain_id: event.chainId,
    });
  }
}
