import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { Token } from '@/routes/balances/entities/token.entity';
import {
  ExecutionDetails,
  ExecutionDetailsType,
} from '@/routes/transactions/entities/transaction-details/execution-details.entity';

export class MultisigConfirmationDetails {
  @ApiProperty()
  signer: AddressInfo;
  @ApiPropertyOptional()
  signature: string | null;
  @ApiProperty()
  submittedAt: number;

  constructor(
    signer: AddressInfo,
    signature: string | null,
    submittedAt: number,
  ) {
    this.signer = signer;
    this.signature = signature;
    this.submittedAt = submittedAt;
  }
}

export class MultisigExecutionDetails extends ExecutionDetails {
  @ApiProperty()
  submittedAt: number;
  @ApiProperty()
  nonce: number;
  @ApiProperty()
  safeTxGas: string;
  @ApiProperty()
  baseGas: string;
  @ApiProperty()
  gasPrice: string;
  @ApiProperty()
  gasToken: string;
  @ApiProperty()
  refundReceiver: AddressInfo;
  @ApiProperty()
  safeTxHash: string;
  @ApiPropertyOptional({ type: AddressInfo, nullable: true })
  executor: AddressInfo | null;
  @ApiProperty()
  signers: AddressInfo[];
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  confirmations: MultisigConfirmationDetails[];
  @ApiProperty({ type: AddressInfo, isArray: true })
  rejectors: AddressInfo[];
  @ApiPropertyOptional({ type: Token, nullable: true })
  gasTokenInfo: Token | null;
  @ApiProperty()
  trusted: boolean;

  constructor(
    submittedAt: number,
    nonce: number,
    safeTxGas: string,
    baseGas: string,
    gasPrice: string,
    gasToken: string,
    refundReceiver: AddressInfo,
    safeTxHash: string,
    executor: AddressInfo | null,
    signers: AddressInfo[],
    confirmationsRequired: number,
    confirmations: MultisigConfirmationDetails[],
    rejectors: AddressInfo[],
    gasTokenInfo: Token | null,
    trusted: boolean,
  ) {
    super(ExecutionDetailsType.Multisig);
    this.submittedAt = submittedAt;
    this.nonce = nonce;
    this.safeTxGas = safeTxGas;
    this.baseGas = baseGas;
    this.gasPrice = gasPrice;
    this.gasToken = gasToken;
    this.refundReceiver = refundReceiver;
    this.safeTxHash = safeTxHash;
    this.executor = executor;
    this.signers = signers;
    this.confirmationsRequired = confirmationsRequired;
    this.confirmations = confirmations;
    this.rejectors = rejectors;
    this.gasTokenInfo = gasTokenInfo;
    this.trusted = trusted;
  }
}
