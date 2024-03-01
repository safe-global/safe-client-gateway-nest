import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';

export interface Confirmation {
  owner: string;
  signature: string | null;
  signatureType: string;
  submissionDate: Date;
  transactionHash: string | null;
}

export type MultisigTransaction = {
  baseGas: number | null;
  blockNumber: number | null;
  confirmations: Confirmation[] | null;
  confirmationsRequired: number;
  data: string | null;
  dataDecoded: DataDecoded | null;
  ethGasPrice: string | null;
  executionDate: Date | null;
  executor: string | null;
  fee: string | null;
  gasPrice: string | null;
  gasToken: string | null;
  gasUsed: number | null;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  modified: Date | null;
  nonce: number;
  operation: Operation;
  origin: string | null;
  refundReceiver: string | null;
  safe: string;
  safeTxGas: number | null;
  safeTxHash: string;
  signatures: string | null;
  submissionDate: Date;
  to: string;
  transactionHash: string | null;
  trusted: boolean;
  value: string;
};
