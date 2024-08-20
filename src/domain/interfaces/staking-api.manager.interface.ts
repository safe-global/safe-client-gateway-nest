import { IApiManager } from '@/domain/interfaces/api.manager.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';

export const IStakingApiManager = Symbol('IStakingApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IStakingApiManager extends IApiManager<IStakingApi> {}