import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export class CacheRouter {
  private static readonly ALL_TRANSACTIONS_KEY = 'all_transactions';
  private static readonly BACKBONE_KEY = 'backbone';
  private static readonly CHAIN_KEY = 'chain';
  private static readonly CHAINS_KEY = 'chains';
  private static readonly COLLECTIBLES_KEY = 'collectibles';
  private static readonly CONTRACT_KEY = 'contract';
  private static readonly CREATION_TRANSACTION_KEY = 'creation_transaction';
  private static readonly DELEGATES_KEY = 'delegates';
  private static readonly FIAT_CODES_KEY = 'fiat_codes';
  private static readonly INCOMING_TRANSFERS_KEY = 'incoming_transfers';
  private static readonly MASTER_COPIES_KEY = 'master_copies';
  private static readonly MESSAGE_KEY = 'message';
  private static readonly MESSAGES_KEY = 'messages';
  private static readonly MODULE_TRANSACTION_KEY = 'module_transaction';
  private static readonly MODULE_TRANSACTIONS_KEY = 'module_transactions';
  private static readonly MULTISIG_TRANSACTION_KEY = 'multisig_transaction';
  private static readonly MULTISIG_TRANSACTIONS_KEY = 'multisig_transactions';
  private static readonly NATIVE_COIN_PRICE_KEY = 'native_coin_price';
  private static readonly OWNERS_SAFE_KEY = 'owner_safes';
  private static readonly SAFE_APPS_KEY = 'safe_apps';
  private static readonly SAFE_KEY = 'safe';
  private static readonly BALANCES_KEY = 'balances';
  private static readonly TOKEN_KEY = 'token';
  private static readonly TOKEN_PRICE_KEY = 'token_price';
  private static readonly TOKENS_KEY = 'tokens';
  private static readonly TRANSFER_KEY = 'transfer';
  private static readonly TRANSFERS_KEY = 'transfers';

  static getBalancesCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.BALANCES_KEY}_${args.safeAddress}`;
  }

  static getBalancesCacheDir(args: {
    chainId: string;
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getBalancesCacheKey(args),
      `${args.trusted}_${args.excludeSpam}`,
    );
  }

  static getSafeCacheDir(args: {
    chainId: string;
    safeAddress: string;
  }): CacheDir {
    return new CacheDir(CacheRouter.getSafeCacheKey(args), '');
  }

  static getSafeCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.SAFE_KEY}_${args.safeAddress}`;
  }

  static getContractCacheDir(args: {
    chainId: string;
    contractAddress: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.CONTRACT_KEY}_${args.contractAddress}`,
      '',
    );
  }

  static getContractsCachePattern(): string {
    return `*_${CacheRouter.CONTRACT_KEY}_*`;
  }

  static getBackboneCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.BACKBONE_KEY}`, '');
  }

  static getMasterCopiesCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.MASTER_COPIES_KEY}`, '');
  }

  static getCollectiblesCacheDir(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getCollectiblesKey(args),
      `${args.limit}_${args.offset}_${args.trusted}_${args.excludeSpam}`,
    );
  }

  static getCollectiblesKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.COLLECTIBLES_KEY}_${args.safeAddress}`;
  }

  static getDelegatesCacheDir(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.DELEGATES_KEY}_${args.safeAddress}`,
      `${args.delegate}_${args.delegator}_${args.label}_${args.limit}_${args.offset}`,
    );
  }

  static getTransferCacheDir(args: {
    chainId: string;
    transferId: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.TRANSFER_KEY}_${args.transferId}`,
      '',
    );
  }

  static getTransfersCacheDir(args: {
    chainId: string;
    safeAddress: string;
    onlyErc20: boolean;
    onlyErc721: boolean;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getTransfersCacheKey(args),
      `${args.onlyErc20}_${args.onlyErc721}_${args.limit}_${args.offset}`,
    );
  }

  static getTransfersCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.TRANSFERS_KEY}_${args.safeAddress}`;
  }

  static getModuleTransactionCacheDir(args: {
    chainId: string;
    moduleTransactionId: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.MODULE_TRANSACTION_KEY}_${args.moduleTransactionId}`,
      '',
    );
  }

  static getModuleTransactionsCacheDir(args: {
    chainId: string;
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getModuleTransactionsCacheKey(args),
      `${args.to}_${args.module}_${args.limit}_${args.offset}`,
    );
  }

  static getModuleTransactionsCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MODULE_TRANSACTIONS_KEY}_${args.safeAddress}`;
  }

  static getIncomingTransfersCacheDir(args: {
    chainId: string;
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getIncomingTransfersCacheKey(args),
      `${args.executionDateGte}_${args.executionDateLte}_${args.to}_${args.value}_${args.tokenAddress}_${args.limit}_${args.offset}`,
    );
  }

  static getIncomingTransfersCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.INCOMING_TRANSFERS_KEY}_${args.safeAddress}`;
  }

  static getMultisigTransactionsCacheDir(args: {
    chainId: string;
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getMultisigTransactionsCacheKey(args),
      `${args.ordering}_${args.executed}_${args.trusted}_${args.executionDateGte}_${args.executionDateLte}_${args.to}_${args.value}_${args.nonce}_${args.nonceGte}_${args.limit}_${args.offset}`,
    );
  }

  static getMultisigTransactionsCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MULTISIG_TRANSACTIONS_KEY}_${args.safeAddress}`;
  }

  static getMultisigTransactionCacheDir(args: {
    chainId: string;
    safeTransactionHash: string;
  }): CacheDir {
    return new CacheDir(CacheRouter.getMultisigTransactionCacheKey(args), '');
  }

  static getMultisigTransactionCacheKey(args: {
    chainId: string;
    safeTransactionHash: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MULTISIG_TRANSACTION_KEY}_${args.safeTransactionHash}`;
  }

  static getCreationTransactionCacheDir(args: {
    chainId: string;
    safeAddress: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.CREATION_TRANSACTION_KEY}_${args.safeAddress}`,
      '',
    );
  }

  static getAllTransactionsCacheDir(args: {
    chainId: string;
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getAllTransactionsKey(args),
      `${args.ordering}_${args.executed}_${args.queued}_${args.limit}_${args.offset}`,
    );
  }

  static getAllTransactionsKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.ALL_TRANSACTIONS_KEY}_${args.safeAddress}`;
  }

  static getTokenCacheDir(args: {
    chainId: string;
    address: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.TOKEN_KEY}_${args.address}`,
      '',
    );
  }

  static getTokensCacheKey(chainId: string): string {
    return `${chainId}_${CacheRouter.TOKENS_KEY}`;
  }

  static getTokensCacheDir(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getTokensCacheKey(args.chainId),
      `${args.limit}_${args.offset}`,
    );
  }

  static getTokensCachePattern(chainId: string): string {
    return `${chainId}_${CacheRouter.TOKEN_KEY}_*`;
  }

  static getSafesByOwnerCacheDir(args: {
    chainId: string;
    ownerAddress: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.OWNERS_SAFE_KEY}_${args.ownerAddress}`,
      '',
    );
  }

  static getMessageByHashCacheKey(args: {
    chainId: string;
    messageHash: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MESSAGE_KEY}_${args.messageHash}`;
  }

  static getMessageByHashCacheDir(args: {
    chainId: string;
    messageHash: string;
  }): CacheDir {
    return new CacheDir(this.getMessageByHashCacheKey(args), '');
  }

  static getMessagesBySafeCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MESSAGES_KEY}_${args.safeAddress}`;
  }

  static getMessagesBySafeCacheDir(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      this.getMessagesBySafeCacheKey(args),
      `${args.limit}_${args.offset}`,
    );
  }

  static getChainsCacheKey(): string {
    return CacheRouter.CHAINS_KEY;
  }

  static getChainsCacheDir(args: {
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getChainsCacheKey(),
      `${args.limit}_${args.offset}`,
    );
  }

  static getChainCacheKey(chainId: string): string {
    return `${chainId}_${CacheRouter.CHAIN_KEY}`;
  }

  static getChainCacheDir(chainId: string): CacheDir {
    return new CacheDir(CacheRouter.getChainCacheKey(chainId), '');
  }

  static getChainsCachePattern(): string {
    return `*_${CacheRouter.CHAIN_KEY}`;
  }

  static getSafeAppsKey(chainId: string): string {
    return `${chainId}_${CacheRouter.SAFE_APPS_KEY}`;
  }

  static getSafeAppsCacheDir(args: {
    chainId?: string;
    clientUrl?: string;
    url?: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.SAFE_APPS_KEY}`,
      `${args.clientUrl}_${args.url}`,
    );
  }

  static getSafeAppsCachePattern(): string {
    return `*_${CacheRouter.SAFE_APPS_KEY}`;
  }

  static getNativeCoinPriceCacheDir(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): CacheDir {
    return new CacheDir(
      `${args.nativeCoinId}_${CacheRouter.NATIVE_COIN_PRICE_KEY}_${args.fiatCode}`,
      '',
    );
  }

  static getTokenPriceCacheDir(args: {
    chainName: string;
    fiatCode: string;
    tokenAddress: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainName}_${CacheRouter.TOKEN_PRICE_KEY}_${args.tokenAddress}_${args.fiatCode}`,
      '',
    );
  }

  static getPriceFiatCodesCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.FIAT_CODES_KEY, '');
  }
}
