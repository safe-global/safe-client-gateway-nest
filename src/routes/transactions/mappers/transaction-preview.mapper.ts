import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';
import { TransactionPreview } from '@/routes/transactions/entities/transaction-preview.entity';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { asError } from '@/logging/utils';

@Injectable()
export class TransactionPreviewMapper {
  constructor(
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async mapTransactionPreview(
    chainId: string,
    safe: Safe,
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    let dataDecoded: DataDecoded | null = null;
    try {
      if (previewTransactionDto.data !== null) {
        dataDecoded = await this.dataDecodedRepository.getDataDecoded({
          chainId,
          data: previewTransactionDto.data,
          to: previewTransactionDto.to,
        });
      }
    } catch (error) {
      this.loggingService.info(
        `Error trying to decode the input data: ${asError(error).message}`,
      );
    }
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      {
        safe: safe.address,
        to: previewTransactionDto.to,
        value: previewTransactionDto.value,
        dataDecoded,
        data: previewTransactionDto.data,
        operation: previewTransactionDto.operation,
        // Keep type safety as only the above are available in previewTransactionDto
      } as MultisigTransaction,
    );
    const txData = await this.transactionDataMapper.mapTransactionData(
      chainId,
      previewTransactionDto,
      dataDecoded,
    );
    return Promise.resolve(new TransactionPreview(txInfo, txData));
  }
}
