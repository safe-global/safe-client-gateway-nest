export interface IApiManager<T> {
  getApi(chainId: string, ...rest: Array<unknown>): Promise<T>;

  destroyApi(chainId: string): void;
}
