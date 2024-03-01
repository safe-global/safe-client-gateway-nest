import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { EventType } from '@/routes/cache-hooks/entities/event-payload.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Event } from '@/routes/cache-hooks/entities/event.entity';

@Injectable()
export class CacheHooksService {
  private static readonly HOOK_TYPE = 'hook';

  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(ICollectiblesRepository)
    private readonly collectiblesRepository: ICollectiblesRepository,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: IMessagesRepository,
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: ISafeAppsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async onEvent(event: Event): Promise<void[]> {
    const promises: Promise<void>[] = [];
    switch (event.type) {
      // A new pending multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case EventType.PENDING_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        this._logSafeTxEvent(event);
        break;
      // A deleted multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case EventType.DELETED_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        this._logSafeTxEvent(event);
        break;
      // An executed module transaction might affect:
      // - the list of all executed transactions for the safe
      // - the list of module transactions for the safe
      // - the safe configuration
      case EventType.MODULE_TRANSACTION:
        promises.push(
          this.safeRepository.clearAllExecutedTransactions({
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
        );
        this._logTxEvent(event);
        break;
      // A new executed multisig transaction affects:
      // - the collectibles that the safe has
      // - the list of all executed transactions for the safe
      // - the transfers for that safe
      // - queued transactions and history – clear multisig transactions
      // - the transaction executed – clear multisig transaction
      // - the safe configuration - clear safe info
      case EventType.EXECUTED_MULTISIG_TRANSACTION:
        promises.push(
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
        );
        this._logSafeTxEvent(event);
        break;
      // A new confirmation for a pending transaction affects:
      // - queued transactions – clear multisig transactions
      // - the pending transaction – clear multisig transaction
      case EventType.NEW_CONFIRMATION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        this._logSafeTxEvent(event);
        break;
      // Incoming ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions (including transfers) for the safe
      // - the incoming transfers for that safe
      case EventType.INCOMING_ETHER:
        promises.push(
          this.balancesRepository.clearLocalBalances({
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
        );
        this._logTxEvent(event);
        break;
      // Outgoing ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      case EventType.OUTGOING_ETHER:
        promises.push(
          this.balancesRepository.clearLocalBalances({
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
        );
        this._logTxEvent(event);
        break;
      // An incoming token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      // - the incoming transfers for that safe
      case EventType.INCOMING_TOKEN:
        promises.push(
          this.balancesRepository.clearLocalBalances({
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
        );
        this._logTxEvent(event);
        break;
      // An outgoing token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      case EventType.OUTGOING_TOKEN:
        promises.push(
          this.balancesRepository.clearLocalBalances({
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
        );
        this._logTxEvent(event);
        break;
      // A message created affects:
      // - the messages associated to the Safe
      case EventType.MESSAGE_CREATED:
        promises.push(
          this.messagesRepository.clearMessagesBySafe({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
        );
        this._logMessageEvent(event);
        break;
      // A new message confirmation affects:
      // - the message itself
      // - the messages associated to the Safe
      case EventType.MESSAGE_CONFIRMATION:
        promises.push(
          this.messagesRepository.clearMessagesByHash({
            chainId: event.chainId,
            messageHash: event.messageHash,
          }),
          this.messagesRepository.clearMessagesBySafe({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
        );
        this._logMessageEvent(event);
        break;
      case EventType.CHAIN_UPDATE:
        promises.push(this.chainsRepository.clearChain(event.chainId));
        this._logEvent(event);
        break;
      case EventType.SAFE_APPS_UPDATE:
        promises.push(this.safeAppsRepository.clearSafeApps(event.chainId));
        this._logEvent(event);
        break;
    }
    return Promise.all(promises);
  }

  private _logSafeTxEvent(
    event: Event & { address: string; safeTxHash: string },
  ): void {
    this.loggingService.info({
      type: CacheHooksService.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      safeTxHash: event.safeTxHash,
    });
  }

  private _logTxEvent(
    event: Event & { address: string; txHash: string },
  ): void {
    this.loggingService.info({
      type: CacheHooksService.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      txHash: event.txHash,
    });
  }

  private _logMessageEvent(
    event: Event & { address: string; messageHash: string },
  ): void {
    this.loggingService.info({
      type: CacheHooksService.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      messageHash: event.messageHash,
    });
  }

  private _logEvent(event: Event): void {
    this.loggingService.info({
      type: CacheHooksService.HOOK_TYPE,
      eventType: event.type,
      chainId: event.chainId,
    });
  }
}
