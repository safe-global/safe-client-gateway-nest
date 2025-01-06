import type { Backbone } from '@/domain/backbone/entities/backbone.entity';
import type { Singleton } from '@/domain/chains/entities/singleton.entity';
import type { Contract } from '@/domain/contracts/entities/contract.entity';
import type { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Estimation } from '@/domain/estimations/entities/estimation.entity';
import type { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import type { IndexingStatus } from '@/domain/indexing/entities/indexing-status.entity';
import type { Message } from '@/domain/messages/entities/message.entity';
import type { Device } from '@/domain/notifications/v1/entities/device.entity';
import type { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import type { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { SafeList } from '@/domain/safe/entities/safe-list.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';
import type { Transaction } from '@/domain/safe/entities/transaction.entity';
import type { Transfer } from '@/domain/safe/entities/transfer.entity';
import type { Token } from '@/domain/tokens/entities/token.entity';
import type { AddConfirmationDto } from '@/domain/transactions/entities/add-confirmation.dto.entity';
import type { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export interface ITransactionApi {
  getDataDecoded(args: {
    data: `0x${string}`;
    to?: `0x${string}`;
  }): Promise<Raw<DataDecoded>>;

  getBackbone(): Promise<Raw<Backbone>>;

  getSingletons(): Promise<Raw<Array<Singleton>>>;

  getIndexingStatus(): Promise<Raw<IndexingStatus>>;

  getSafe(safeAddress: `0x${string}`): Promise<Raw<Safe>>;

  clearSafe(address: `0x${string}`): Promise<void>;

  isSafe(address: `0x${string}`): Promise<boolean>;

  clearIsSafe(address: `0x${string}`): Promise<void>;

  getContract(contractAddress: `0x${string}`): Promise<Raw<Contract>>;

  getDelegates(args: {
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>>;

  getDelegatesV2(args: {
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Delegate>>>;

  clearDelegates(safeAddress?: `0x${string}`): Promise<void>;

  postDelegate(args: {
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void>;

  postDelegateV2(args: {
    safeAddress: `0x${string}` | null;
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    delegate: `0x${string}`;
    safeAddress: `0x${string}`;
    signature: string;
  }): Promise<unknown>;

  deleteDelegateV2(args: {
    delegate: `0x${string}`;
    delegator: `0x${string}`;
    safeAddress: `0x${string}` | null;
    signature: string;
  }): Promise<unknown>;

  getTransfer(transferId: string): Promise<Raw<Transfer>>;

  getTransfers(args: {
    safeAddress: `0x${string}`;
    onlyErc20?: boolean;
    onlyErc721?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Transfer>>>;

  clearTransfers(safeAddress: `0x${string}`): Promise<void>;

  getIncomingTransfers(args: {
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    tokenAddress?: `0x${string}`;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Transfer>>>;

  clearIncomingTransfers(safeAddress: `0x${string}`): Promise<void>;

  postConfirmation(args: {
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getSafesByModule(moduleAddress: `0x${string}`): Promise<Raw<SafeList>>;

  getModuleTransaction(
    moduleTransactionId: string,
  ): Promise<Raw<ModuleTransaction>>;

  getModuleTransactions(args: {
    safeAddress: `0x${string}`;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<ModuleTransaction>>>;

  clearModuleTransactions(safeAddress: `0x${string}`): Promise<void>;

  getMultisigTransaction(
    safeTransactionHash: string,
  ): Promise<Raw<MultisigTransaction>>;

  deleteTransaction(args: {
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  clearMultisigTransaction(safeTransactionHash: string): Promise<void>;

  getMultisigTransactions(args: {
    safeAddress: `0x${string}`;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: `0x${string}`;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<MultisigTransaction>>>;

  clearMultisigTransactions(safeAddress: `0x${string}`): Promise<void>;

  getCreationTransaction(
    safeAddress: `0x${string}`,
  ): Promise<Raw<CreationTransaction>>;

  getAllTransactions(args: {
    safeAddress: `0x${string}`;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Transaction>>>;

  clearAllTransactions(safeAddress: `0x${string}`): Promise<void>;

  getToken(address: `0x${string}`): Promise<Raw<Token>>;

  getTokens(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Token>>>;

  getSafesByOwner(ownerAddress: `0x${string}`): Promise<Raw<SafeList>>;

  postDeviceRegistration(args: {
    device: Device;
    safes: Array<string>;
    signatures: Array<string>;
  }): Promise<void>;

  deleteDeviceRegistration(uuid: string): Promise<void>;

  deleteSafeRegistration(args: {
    uuid: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  getEstimation(args: {
    address: `0x${string}`;
    getEstimationDto: GetEstimationDto;
  }): Promise<Raw<Estimation>>;

  getMessageByHash(messageHash: string): Promise<Raw<Message>>;

  getMessagesBySafe(args: {
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Message>>>;

  postMultisigTransaction(args: {
    address: `0x${string}`;
    data: ProposeTransactionDto;
  }): Promise<unknown>;

  postMessage(args: {
    safeAddress: `0x${string}`;
    message: unknown;
    safeAppId: number | null;
    signature: string;
    origin: string | null;
  }): Promise<Raw<Message>>;

  postMessageSignature(args: {
    messageHash: string;
    signature: `0x${string}`;
  }): Promise<unknown>;

  clearMessagesBySafe(args: { safeAddress: `0x${string}` }): Promise<void>;

  clearMessagesByHash(args: { messageHash: string }): Promise<void>;
}
