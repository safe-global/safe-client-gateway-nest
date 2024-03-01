import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { ModuleExecutionDetails } from '@/routes/transactions/entities/transaction-details/module-execution-details.entity';
import { MultisigExecutionDetails } from '@/routes/transactions/entities/transaction-details/multisig-execution-details.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';

@ApiExtraModels(
  TransactionInfo,
  TransactionData,
  MultisigExecutionDetails,
  ModuleExecutionDetails,
  SafeAppInfo,
)
export class TransactionDetails {
  @ApiProperty()
  safeAddress!: string;
  @ApiProperty()
  txId!: string;
  @ApiPropertyOptional({ type: Number, nullable: true })
  executedAt!: number | null;
  @ApiProperty()
  txStatus!: TransactionStatus;
  @ApiProperty()
  txInfo!: TransactionInfo;
  @ApiPropertyOptional({ type: TransactionData, nullable: true })
  txData!: TransactionData | null;
  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(MultisigExecutionDetails) },
      { $ref: getSchemaPath(ModuleExecutionDetails) },
    ],
    nullable: true,
  })
  detailedExecutionInfo!:
    | MultisigExecutionDetails
    | ModuleExecutionDetails
    | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  txHash!: string | null;
  @ApiPropertyOptional({ type: SafeAppInfo, nullable: true })
  safeAppInfo!: SafeAppInfo | null;
}
