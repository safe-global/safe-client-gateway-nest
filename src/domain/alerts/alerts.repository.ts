import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { IAccountRepository } from '@/domain/account/account.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { UrlGeneratorHelper } from '@/domain/alerts/urls/url-generator.helper';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  private static readonly UNKNOWN_TX_EMAIL_SUBJECT = 'Malicious transaction';
  private static readonly RECOVERY_TX_EMAIL_SUBJECT = 'Recovery attempt';

  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    @Inject(IEmailApi)
    private readonly emailApi: IEmailApi,
    @Inject(IAccountRepository)
    private readonly accountRepository: IAccountRepository,
    private readonly urlGenerator: UrlGeneratorHelper,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainRepository: IChainsRepository,
  ) {}

  async addContracts(contracts: Array<AlertsRegistration>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  async handleAlertLog(chainId: string, log: AlertLog): Promise<void> {
    const moduleAddress = log.address;

    const { safes } = await this.safeRepository.getSafesByModule({
      chainId,
      moduleAddress,
    });

    if (safes.length === 0) {
      this.loggingService.debug(
        `An alert for a module that is not activated on a Safe was received. moduleAddress=${moduleAddress}`,
      );
      return;
    }

    // Recovery module is deployed per Safe so we can assume that it is only enabled on one
    const safeAddress = safes[0];

    const emails = await this.accountRepository.getVerifiedEmailsBySafeAddress({
      chainId,
      safeAddress,
    });

    if (emails.length === 0) {
      this.loggingService.debug(
        `An alert for a Safe with no associated emails was received. moduleAddress=${moduleAddress}, safeAddress=${safeAddress}`,
      );
      return;
    }

    try {
      const safe = await this.safeRepository.getSafe({
        chainId,
        address: safeAddress,
      });

      const decodedEvent = this.delayModifierDecoder.decodeEventLog({
        data: log.data as Hex,
        topics: log.topics as [Hex, Hex, Hex],
      });
      const decodedTransactions = this._decodeTransactionAdded(
        decodedEvent.args.data,
      );

      const newSafeState = await this._mapSafeSetup({
        safe,
        decodedTransactions,
      });

      this._notifySafeSetup({
        chainId,
        newSafeState,
      });
    } catch {
      this._notifyUnknownTransaction({ chainId, safeAddress, emails });
    }
  }

  private _decodeTransactionAdded(
    data: Hex,
  ): Array<ReturnType<typeof this._decodeRecoveryTransaction>> {
    try {
      return this.multiSendDecoder
        .mapMultiSendTransactions(data)
        .flatMap((multiSend) => {
          return this._decodeRecoveryTransaction(multiSend.data);
        });
    } catch {
      return [this._decodeRecoveryTransaction(data)];
    }
  }

  private _decodeRecoveryTransaction(
    data: Hex,
  ): ReturnType<typeof this.safeDecoder.decodeFunctionData> {
    const decoded = this.safeDecoder.decodeFunctionData({ data });

    const isRecoveryTransaction = [
      'addOwnerWithThreshold',
      'removeOwner',
      'swapOwner',
      'changeThreshold',
    ].includes(decoded.functionName);

    if (!isRecoveryTransaction) {
      throw new Error('Unknown recovery transaction');
    }

    return decoded;
  }

  private async _mapSafeSetup(args: {
    safe: Safe;
    decodedTransactions: Array<ReturnType<SafeDecoder['decodeFunctionData']>>;
  }): Promise<Safe> {
    return args.decodedTransactions.reduce((newSafe, decodedTransaction) => {
      switch (decodedTransaction.functionName) {
        case 'addOwnerWithThreshold': {
          const [ownerToAdd, newThreshold] = decodedTransaction.args;

          newSafe.owners.push(ownerToAdd);
          newSafe.threshold = Number(newThreshold);
          break;
        }
        case 'removeOwner': {
          const [, ownerToRemove, newThreshold] = decodedTransaction.args;

          newSafe.owners = newSafe.owners.filter((owner) => {
            return owner.toLowerCase() !== ownerToRemove.toLowerCase();
          });
          newSafe.threshold = Number(newThreshold);
          break;
        }
        case 'swapOwner': {
          const [, ownerToRemove, ownerToAdd] = decodedTransaction.args;

          newSafe.owners = newSafe.owners.map((owner) => {
            return owner.toLowerCase() === ownerToRemove.toLowerCase()
              ? ownerToAdd
              : owner;
          });
          break;
        }
        case 'changeThreshold': {
          const [newThreshold] = decodedTransaction.args;

          newSafe.threshold = Number(newThreshold);
          break;
        }
        default: {
          throw new Error(
            `Unknown recovery transaction ${decodedTransaction?.functionName}`,
          );
        }
      }

      return newSafe;
    }, structuredClone(args.safe));
  }

  private async _notifyUnknownTransaction(args: {
    safeAddress: string;
    chainId: string;
    emails: string[];
  }): Promise<void> {
    const chain = await this.chainRepository.getChain(args.chainId);

    const webAppUrl = this.urlGenerator.addressToSafeWebAppUrl({
      chain,
      safeAddress: args.safeAddress,
    });

    return this.emailApi.createMessage({
      to: args.emails,
      template: this.configurationService.getOrThrow<string>(
        'email.templates.unknownRecoveryTx',
      ),
      subject: AlertsRepository.UNKNOWN_TX_EMAIL_SUBJECT,
      substitutions: {
        webAppUrl,
      },
    });
  }

  private async _notifySafeSetup(args: {
    chainId: string;
    newSafeState: Safe;
  }): Promise<void> {
    const emails = await this.accountRepository.getVerifiedEmailsBySafeAddress({
      chainId: args.chainId,
      safeAddress: args.newSafeState.address,
    });

    if (!emails.length) {
      this.loggingService.debug(
        `An alert log for an transaction with no verified emails associated was thrown for Safe ${args.newSafeState.address}`,
      );
      return;
    }

    const chain = await this.chainRepository.getChain(args.chainId);

    const webAppUrl = this.urlGenerator.addressToSafeWebAppUrl({
      chain,
      safeAddress: args.newSafeState.address,
    });
    const owners = args.newSafeState.owners.map((address) => {
      return {
        address,
        explorerUrl: this.urlGenerator.addressToExplorerUrl({
          chain,
          address,
        }),
      };
    });

    return this.emailApi.createMessage({
      to: emails,
      template: this.configurationService.getOrThrow<string>(
        'email.templates.recoveryTx',
      ),
      subject: AlertsRepository.RECOVERY_TX_EMAIL_SUBJECT,
      substitutions: {
        webAppUrl,
        owners,
        threshold: args.newSafeState.threshold.toString(),
      },
    });
  }
}
