import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { MasterCopy } from '@/domain/chains/entities/master-copies.entity';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { Page } from '@/domain/entities/page.entity';
import { Estimation } from '@/domain/estimations/entities/estimation.entity';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { Message } from '@/domain/messages/entities/message.entity';
import { Device } from '@/domain/notifications/entities/device.entity';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeList } from '@/domain/safe/entities/safe-list.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transaction } from '@/domain/safe/entities/transaction.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { Token } from '@/domain/tokens/entities/token.entity';
import { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

export interface ITransactionApi {
  getBalances(args: {
    safeAddress: string;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Balance[]>;

  clearLocalBalances(safeAddress: string): Promise<void>;

  getDataDecoded(args: { data: string; to?: string }): Promise<DataDecoded>;

  getCollectibles(args: {
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>>;

  clearCollectibles(safeAddress: string): Promise<void>;

  getBackbone(): Promise<Backbone>;

  getMasterCopies(): Promise<MasterCopy[]>;

  getSafe(safeAddress: string): Promise<Safe>;

  clearSafe(address: string): Promise<void>;

  getContract(contractAddress: string): Promise<Contract>;

  getDelegates(args: {
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    signature?: string;
    label?: string;
  }): Promise<void>;

  deleteDelegate(args: {
    delegate: string;
    delegator: string;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    delegate: string;
    safeAddress: string;
    signature: string;
  }): Promise<unknown>;

  getTransfer(transferId: string): Promise<Transfer>;

  getTransfers(args: {
    safeAddress: string;
    onlyErc20?: boolean;
    onlyErc721?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearTransfers(safeAddress: string): Promise<void>;

  getIncomingTransfers(args: {
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearIncomingTransfers(safeAddress: string): Promise<void>;

  postConfirmation(args: {
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getSafesByModule(moduleAddress: string): Promise<SafeList>;

  getModuleTransaction(moduleTransactionId: string): Promise<ModuleTransaction>;

  getModuleTransactions(args: {
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>>;

  clearModuleTransactions(safeAddress: string): Promise<void>;

  getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<MultisigTransaction>;

  deleteTransaction(args: {
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  clearMultisigTransaction(safeTransactionHash: string): Promise<void>;

  getMultisigTransactions(args: {
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
  }): Promise<Page<MultisigTransaction>>;

  clearMultisigTransactions(safeAddress: string): Promise<void>;

  getCreationTransaction(safeAddress: string): Promise<CreationTransaction>;

  getAllTransactions(args: {
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>>;

  clearAllTransactions(safeAddress: string): Promise<void>;

  getToken(address: string): Promise<Token>;

  getTokens(args: { limit?: number; offset?: number }): Promise<Page<Token>>;

  getSafesByOwner(ownerAddress: string): Promise<SafeList>;

  postDeviceRegistration(args: {
    device: Device;
    safes: string[];
    signatures: string[];
  }): Promise<void>;

  deleteDeviceRegistration(uuid: string): Promise<void>;

  deleteSafeRegistration(args: {
    uuid: string;
    safeAddress: string;
  }): Promise<void>;

  getEstimation(args: {
    address: string;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation>;

  getMessageByHash(messageHash: string): Promise<Message>;

  getMessagesBySafe(args: {
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Message>>;

  postMultisigTransaction(args: {
    address: string;
    data: ProposeTransactionDto;
  }): Promise<unknown>;

  postMessage(args: {
    safeAddress: string;
    message: string | unknown;
    safeAppId: number | null;
    signature: string;
  }): Promise<Message>;

  postMessageSignature(args: {
    messageHash: string;
    signature: string;
  }): Promise<unknown>;

  clearMessagesBySafe(args: { safeAddress: string }): Promise<void>;

  clearMessagesByHash(args: { messageHash: string }): Promise<void>;
}
