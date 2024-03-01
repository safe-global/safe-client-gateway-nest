import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';

export const IAlertsApi = Symbol('IAlertsApi');

export interface IAlertsApi {
  addContracts(contracts: Array<AlertsRegistration>): Promise<void>;
}
