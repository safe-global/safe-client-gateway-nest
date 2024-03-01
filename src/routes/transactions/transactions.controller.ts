import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import { Page } from '@/routes/common/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { AddConfirmationDto } from '@/routes/transactions/entities/add-confirmation.dto';
import { IncomingTransferPage } from '@/routes/transactions/entities/incoming-transfer-page.entity';
import { IncomingTransfer } from '@/routes/transactions/entities/incoming-transfer.entity';
import { ModuleTransactionPage } from '@/routes/transactions/entities/module-transaction-page.entity';
import { ModuleTransaction } from '@/routes/transactions/entities/module-transaction.entity';
import { MultisigTransactionPage } from '@/routes/transactions/entities/multisig-transaction-page.entity';
import { MultisigTransaction } from '@/routes/transactions/entities/multisig-transaction.entity';
import { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';
import { ProposeTransactionDto } from '@/routes/transactions/entities/propose-transaction.dto.entity';
import { QueuedItemPage } from '@/routes/transactions/entities/queued-item-page.entity';
import { QueuedItem } from '@/routes/transactions/entities/queued-item.entity';
import { TransactionDetails } from '@/routes/transactions/entities/transaction-details/transaction-details.entity';
import { TransactionItemPage } from '@/routes/transactions/entities/transaction-item-page.entity';
import { TransactionPreview } from '@/routes/transactions/entities/transaction-preview.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { AddConfirmationDtoValidationPipe } from '@/routes/transactions/pipes/add-confirmation.validation.pipe';
import { PreviewTransactionDtoValidationPipe } from '@/routes/transactions/pipes/preview-transaction.validation.pipe';
import { ProposeTransactionDtoValidationPipe } from '@/routes/transactions/pipes/propose-transaction.dto.validation.pipe';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import { DeleteTransactionDtoValidationPipe } from '@/routes/transactions/pipes/delete-transaction.validation.pipe';
import { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';

@ApiTags('transactions')
@Controller({
  path: '',
  version: '1',
})
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOkResponse({ type: TransactionDetails })
  @Get(`chains/:chainId/transactions/:id`)
  async getTransactionById(
    @Param('chainId') chainId: string,
    @Param('id') id: string,
  ): Promise<TransactionDetails> {
    return this.transactionsService.getById({
      chainId,
      txId: id,
    });
  }

  @ApiOkResponse({ type: MultisigTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/multisig-transactions')
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value', required: false, type: String })
  @ApiQuery({ name: 'nonce', required: false, type: String })
  @ApiQuery({ name: 'executed', required: false, type: Boolean })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getMultisigTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress') safeAddress: string,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to') to?: string,
    @Query('value') value?: string,
    @Query('nonce') nonce?: string,
    @Query('executed', new ParseBoolPipe({ optional: true }))
    executed?: boolean,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    return this.transactionsService.getMultisigTransactions({
      chainId,
      routeUrl,
      paginationData,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      nonce,
      executed,
    });
  }

  @Delete('chains/:chainId/transactions/:safeTxHash')
  async deleteTransaction(
    @Param('chainId') chainId: string,
    @Param('safeTxHash') safeTxHash: string,
    @Body(DeleteTransactionDtoValidationPipe)
    deleteTransactionDto: DeleteTransactionDto,
  ): Promise<void> {
    return this.transactionsService.deleteTransaction({
      chainId,
      safeTxHash,
      signature: deleteTransactionDto.signature,
    });
  }

  @ApiOkResponse({ type: ModuleTransactionPage })
  @Get('chains/:chainId/safes/:safeAddress/module-transactions')
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getModuleTransactions(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Param('safeAddress') safeAddress: string,
    @Query('to') to?: string,
    @Query('module') module?: string,
  ): Promise<Page<ModuleTransaction>> {
    return this.transactionsService.getModuleTransactions({
      chainId,
      routeUrl,
      safeAddress,
      to,
      module,
      paginationData,
    });
  }

  @HttpCode(200)
  @ApiOkResponse({ type: Transaction })
  @Post('chains/:chainId/transactions/:safeTxHash/confirmations')
  async addConfirmation(
    @Param('chainId') chainId: string,
    @Param('safeTxHash') safeTxHash: string,
    @Body(AddConfirmationDtoValidationPipe)
    addConfirmationDto: AddConfirmationDto,
  ): Promise<TransactionDetails> {
    return this.transactionsService.addConfirmation({
      chainId,
      safeTxHash,
      addConfirmationDto,
    });
  }

  @ApiOkResponse({ type: IncomingTransferPage })
  @Get('chains/:chainId/safes/:safeAddress/incoming-transfers')
  @ApiQuery({ name: 'execution_date__gte', required: false, type: String })
  @ApiQuery({ name: 'execution_date__lte', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'value', required: false, type: String })
  @ApiQuery({ name: 'token_address', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getIncomingTransfers(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('execution_date__gte') executionDateGte?: string,
    @Query('execution_date__lte') executionDateLte?: string,
    @Query('to') to?: string,
    @Query('value') value?: string,
    @Query('token_address') tokenAddress?: string,
  ): Promise<Partial<Page<IncomingTransfer>>> {
    return this.transactionsService.getIncomingTransfers({
      chainId,
      routeUrl,
      safeAddress,
      executionDateGte,
      executionDateLte,
      to,
      value,
      tokenAddress,
      paginationData,
    });
  }

  @ApiOkResponse({ type: TransactionPreview })
  @HttpCode(200)
  @Post('chains/:chainId/transactions/:safeAddress/preview')
  async previewTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(PreviewTransactionDtoValidationPipe)
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    return this.transactionsService.previewTransaction({
      chainId,
      safeAddress,
      previewTransactionDto,
    });
  }

  @ApiOkResponse({ type: QueuedItemPage })
  @Get('chains/:chainId/safes/:safeAddress/transactions/queued')
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'trusted', required: false, type: Boolean })
  async getTransactionQueue(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted: boolean,
  ): Promise<Partial<Page<QueuedItem>>> {
    return this.transactionsService.getTransactionQueue({
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
      trusted,
    });
  }

  @ApiOkResponse({ type: TransactionItemPage })
  @Get('chains/:chainId/safes/:safeAddress/transactions/history')
  @ApiQuery({ name: 'timezone_offset', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getTransactionsHistory(
    @Param('chainId') chainId: string,
    @RouteUrlDecorator() routeUrl: URL,
    @Param('safeAddress') safeAddress: string,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('timezone_offset', new DefaultValuePipe(0), ParseIntPipe)
    timezoneOffsetMs: number,
    @Query('trusted', new DefaultValuePipe(true), ParseBoolPipe)
    trusted: boolean,
  ): Promise<Partial<TransactionItemPage>> {
    return this.transactionsService.getTransactionHistory({
      chainId,
      routeUrl,
      safeAddress,
      paginationData,
      timezoneOffsetMs,
      onlyTrusted: trusted,
    });
  }

  @HttpCode(200)
  @ApiOkResponse({ type: Transaction })
  @Post('chains/:chainId/transactions/:safeAddress/propose')
  async proposeTransaction(
    @Param('chainId') chainId: string,
    @Param('safeAddress') safeAddress: string,
    @Body(ProposeTransactionDtoValidationPipe)
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<TransactionDetails> {
    return this.transactionsService.proposeTransaction({
      chainId,
      safeAddress,
      proposeTransactionDto,
    });
  }
}
