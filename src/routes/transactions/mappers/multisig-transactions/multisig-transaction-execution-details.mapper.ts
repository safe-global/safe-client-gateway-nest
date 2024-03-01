import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  MultisigConfirmationDetails,
  MultisigExecutionDetails,
} from '@/routes/transactions/entities/transaction-details/multisig-execution-details.entity';

@Injectable()
export class MultisigTransactionExecutionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async mapMultisigExecutionDetails(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<MultisigExecutionDetails> {
    const signers = safe.owners.map((owner) => new AddressInfo(owner));
    const gasToken = transaction.gasToken ?? NULL_ADDRESS;
    const confirmationsRequired =
      transaction.confirmationsRequired ?? safe.threshold;
    const confirmations = !transaction.confirmations
      ? []
      : transaction.confirmations.map(
          (confirmation) =>
            new MultisigConfirmationDetails(
              new AddressInfo(confirmation.owner),
              confirmation.signature,
              confirmation.submissionDate.getTime(),
            ),
        );

    const [gasTokenInfo, executor, refundReceiver, rejectors] =
      await Promise.all([
        gasToken != NULL_ADDRESS
          ? this.tokenRepository.getToken({ chainId, address: gasToken })
          : Promise.resolve(null),
        transaction.executor
          ? this.addressInfoHelper.getOrDefault(chainId, transaction.executor, [
              'CONTRACT',
            ])
          : Promise.resolve(null),
        this.addressInfoHelper.getOrDefault(
          chainId,
          transaction.refundReceiver ?? NULL_ADDRESS,
          ['CONTRACT'],
        ),
        this._getRejectors(chainId, transaction),
      ]);

    return new MultisigExecutionDetails(
      transaction.submissionDate.getTime(),
      transaction.nonce,
      transaction.safeTxGas?.toString() ?? '0',
      transaction.baseGas?.toString() ?? '0',
      transaction.gasPrice?.toString() ?? '0',
      gasToken,
      refundReceiver,
      transaction.safeTxHash,
      executor,
      signers,
      confirmationsRequired,
      confirmations,
      rejectors,
      gasTokenInfo,
      transaction.trusted,
    );
  }

  /**
   * Gets an array of {@link AddressInfo} representing the confirmations of the rejection
   * transaction for the {@link Transaction} passed in.
   *
   * When a transaction is cancelled, another transaction acts as rejection.
   * The rejection transaction has the same 'nonce' of the transaction being cancelled,
   * its 'value' is 0, and its 'to' is the address of the safe that owns the transaction.
   *
   * This function retrieves that rejection transaction, and collects its confirmations as rejectors.
   *
   * @param chainId - chain id to use
   * @param transaction - transaction to use
   * @param safe - safe to use
   * @returns confirmations for the rejection transaction
   */
  private async _getRejectors(
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<AddressInfo[]> {
    const rejectionTxsPage = await this.safeRepository.getMultisigTransactions({
      chainId: chainId,
      safeAddress: transaction.safe,
      to: transaction.safe,
      value: '0',
      nonce: transaction.nonce.toString(),
    });

    // This only considers one page of nonce-sharing transactions, which
    // would cover the vast majority of the cases. If needed, could be
    // extended by requesting and iterating over multiple pages.
    const rejectionTx = rejectionTxsPage.results.find(
      (tx) => tx.safeTxHash != transaction.safeTxHash,
    );

    return (
      rejectionTx?.confirmations?.map(
        (confirmation) => new AddressInfo(confirmation.owner),
      ) ?? []
    );
  }
}
