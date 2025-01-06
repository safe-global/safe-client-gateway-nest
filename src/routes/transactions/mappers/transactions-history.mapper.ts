import { Inject, Injectable } from '@nestjs/common';
import groupBy from 'lodash/groupBy';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  isCreationTransaction,
  isEthereumTransaction,
  isModuleTransaction,
  isMultisigTransaction,
  Transaction as TransactionDomain,
} from '@/domain/safe/entities/transaction.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import { CreationTransactionMapper } from '@/routes/transactions/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TransferImitationMapper } from '@/routes/transactions/mappers/transfers/transfer-imitation.mapper';
import {
  calculateTimezoneOffset,
  convertToTimezone,
} from '@/routes/transactions/helpers/timezone.helper';

@Injectable()
export class TransactionsHistoryMapper {
  private readonly maxNestedTransfers: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly transferMapper: TransferMapper,
    private readonly transferImitationMapper: TransferImitationMapper,
    private readonly creationTransactionMapper: CreationTransactionMapper,
  ) {
    this.maxNestedTransfers = this.configurationService.getOrThrow(
      'mappings.history.maxNestedTransfers',
    );
  }

  async mapTransactionsHistory(
    chainId: string,
    transactionsDomain: Array<TransactionDomain>,
    safe: Safe,
    offset: number,
    timezoneOffset: number,
    onlyTrusted: boolean,
    showImitations: boolean,
    timezone?: string,
  ): Promise<Array<TransactionItem | DateLabel>> {
    if (transactionsDomain.length == 0) {
      return [];
    }

    let previousTransaction: TransactionItem | undefined;

    /**
     * We insert a {@link DateLabel} between transactions on different days.
     * On subsequent pages (offset > 0), we fetch the last transaction of previous page
     * to determine if the first transaction of the current page is on the same day.
     */
    if (offset > 0 && transactionsDomain.length > 1) {
      previousTransaction = await this.getPreviousTransaction({
        transactionsDomain,
        chainId,
        safe,
        onlyTrusted,
      });

      // Remove first transaction that was requested to get previous day timestamp
      transactionsDomain = transactionsDomain.slice(1);
    }

    const mappedTransactions = await this.getMappedTransactions({
      transactionsDomain,
      chainId,
      safe,
      previousTransaction,
      onlyTrusted,
      showImitations,
    });

    // The groups respect timezone offset – this was done for grouping only.
    const transactionsByDay = this.groupByDay(
      mappedTransactions,
      timezoneOffset,
      timezone,
    );
    return transactionsByDay.reduce<Array<TransactionItem | DateLabel>>(
      (transactionList, transactionsOnDay) => {
        // The actual value of the group should be in the UTC timezone instead
        // A group should always have at least one transaction.
        const { timestamp } = transactionsOnDay[0].transaction;

        // If the current group is a follow-up from the previous page,
        // or the group is empty, the date label shouldn't be added.
        const isFollowUp =
          timestamp == previousTransaction?.transaction.timestamp;
        if (!isFollowUp && transactionsOnDay.length > 0 && timestamp) {
          transactionList.push(new DateLabel(timestamp));
        }
        return transactionList.concat(transactionsOnDay);
      },
      [],
    );
  }

  private async getPreviousTransaction(args: {
    transactionsDomain: Array<TransactionDomain>;
    chainId: string;
    safe: Safe;
    onlyTrusted: boolean;
  }): Promise<TransactionItem | undefined> {
    const prevDomainTransaction = args.transactionsDomain[0];
    // We map in order to filter last list item against it
    const mappedPreviousTransaction = await this.mapTransaction(
      prevDomainTransaction,
      args.chainId,
      args.safe,
      args.onlyTrusted,
    );

    return Array.isArray(mappedPreviousTransaction)
      ? // All transfers should have same execution date but the last is "true" previous
        mappedPreviousTransaction.at(-1)
      : mappedPreviousTransaction;
  }

  private async getMappedTransactions(args: {
    transactionsDomain: Array<TransactionDomain>;
    chainId: string;
    safe: Safe;
    previousTransaction: TransactionItem | undefined;
    onlyTrusted: boolean;
    showImitations: boolean;
  }): Promise<Array<TransactionItem>> {
    const mappedTransactions = await Promise.all(
      args.transactionsDomain.map((transaction) => {
        return this.mapTransaction(
          transaction,
          args.chainId,
          args.safe,
          args.onlyTrusted,
        );
      }),
    );
    const transactionItems = mappedTransactions
      .filter(<T>(x: T): x is NonNullable<T> => x != null)
      .flat();

    return this.transferImitationMapper.mapImitations({
      transactions: transactionItems,
      previousTransaction: args.previousTransaction,
      showImitations: args.showImitations,
    });
  }

  private groupByDay(
    transactions: Array<TransactionItem>,
    timezoneOffset: number,
    timezone?: string,
  ): Array<Array<TransactionItem>> {
    const grouped = groupBy(transactions, ({ transaction }) => {
      // timestamp will always be defined for historical transactions
      const date = new Date(transaction.timestamp ?? 0);
      return this.getDayStartForDate(date, timezoneOffset, timezone).getTime();
    });
    return Object.values(grouped);
  }

  /**
   * Returns a day {@link Date } at 00:00:00 from the input timestamp.
   *
   * @param timestamp - date to convert
   * @param timezoneOffset - Offset of time zone in milliseconds
   * @param {string} timezone - If timezone id is passed, timezoneOffset will be ignored
   */
  private getDayStartForDate(
    timestamp: Date,
    timezoneOffset: number,
    timezone?: string,
  ): Date {
    return timezone
      ? convertToTimezone(timestamp, timezone)
      : calculateTimezoneOffset(timestamp, timezoneOffset);
  }

  private async mapTransfers(
    transfers: Array<Transfer>,
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
  ): Promise<Array<TransactionItem>> {
    const limitedTransfers = transfers.slice(0, this.maxNestedTransfers);

    const nestedTransactions = await this.transferMapper.mapTransfers({
      chainId,
      transfers: limitedTransfers,
      safe,
      onlyTrusted,
    });

    return nestedTransactions.map(
      (nestedTransaction) => new TransactionItem(nestedTransaction),
    );
  }

  private async mapTransaction(
    transaction: TransactionDomain,
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
  ): Promise<TransactionItem | Array<TransactionItem> | undefined> {
    if (isMultisigTransaction(transaction)) {
      return new TransactionItem(
        await this.multisigTransactionMapper.mapTransaction(
          chainId,
          transaction,
          safe,
        ),
      );
    } else if (isModuleTransaction(transaction)) {
      return new TransactionItem(
        await this.moduleTransactionMapper.mapTransaction(chainId, transaction),
      );
    } else if (isEthereumTransaction(transaction)) {
      const transfers = transaction.transfers;
      if (transfers != null) {
        return await this.mapTransfers(transfers, chainId, safe, onlyTrusted);
      }
    } else if (isCreationTransaction(transaction)) {
      return new TransactionItem(
        await this.creationTransactionMapper.mapTransaction(
          chainId,
          transaction,
          safe,
        ),
      );
    } else {
      // This should never happen as Zod would not allow an unknown transaction to get to this stage
      throw Error('Unrecognized transaction type');
    }
  }
}
