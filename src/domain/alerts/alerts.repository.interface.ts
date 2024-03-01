import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';

export const IAlertsRepository = Symbol('IAlertsRepository');

export interface IAlertsRepository {
  /**
   * Adds the {@link contracts} to the Alerts provider
   * @param contracts - the network-specific {@link AlertsRegistration} to add
   */
  addContracts(contracts: Array<AlertsRegistration>): Promise<void>;

  /**
   * Parses and notifies the user about the {@link log} from the Alerts provider
   * @param chainId - chain where the alert log was generated
   * @param log - the {@link AlertLog} to decode
   */
  handleAlertLog(chainId: string, log: AlertLog): Promise<void>;
}
