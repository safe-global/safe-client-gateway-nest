import { Operation } from '@/domain/safe/entities/operation.entity';

export class ProposeTransactionDto {
  to!: string;
  value!: string;
  data!: string | null;
  nonce!: string;
  operation!: Operation;
  safeTxGas!: string;
  baseGas!: string;
  gasPrice!: string;
  gasToken!: string;
  refundReceiver!: string | null;
  safeTxHash!: string;
  sender!: string;
  signature!: string | null;
  origin!: string | null;
}
