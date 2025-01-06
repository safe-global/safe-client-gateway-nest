import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { safeAppInfoBuilder } from '@/routes/transactions/entities/__tests__/safe-app-info.builder';
import { transferTransactionInfoBuilder } from '@/routes/transactions/entities/__tests__/transfer-transaction-info.builder';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { multisigExecutionDetailsBuilder } from '@/routes/transactions/mappers/__tests__/multisig-execution-details.builder';
import type { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import type { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import type { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { MultisigTransactionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-details.mapper';
import type { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import type { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const statusMapper = jest.mocked({
  mapTransactionStatus: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionStatusMapper>);

const transactionInfoMapper = jest.mocked({
  mapTransactionInfo: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionInfoMapper>);

const transactionDataMapper = jest.mocked({
  isTrustedDelegateCall: jest.fn(),
  buildAddressInfoIndex: jest.fn(),
} as jest.MockedObjectDeep<TransactionDataMapper>);

const safeAppInfoMapper = jest.mocked({
  mapSafeAppInfo: jest.fn(),
} as jest.MockedObjectDeep<SafeAppInfoMapper>);

const multisigExecutionDetailsMapper = jest.mocked({
  mapMultisigExecutionDetails: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionExecutionDetailsMapper>);

const multisigTransactionNoteMapper = jest.mocked({
  mapTxNote: jest.fn(),
});

describe('MultisigTransactionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionDetailsMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    mapper = new MultisigTransactionDetailsMapper(
      addressInfoHelper,
      statusMapper,
      transactionInfoMapper,
      transactionDataMapper,
      safeAppInfoMapper,
      multisigExecutionDetailsMapper,
      multisigTransactionNoteMapper,
    );
  });

  it('should return a TransactionDetails object with null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus = faker.helpers.objectValue(TransactionStatus);
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const safeAppInfo = safeAppInfoBuilder().build();
    safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(safeAppInfo);
    const multisigExecutionDetails = multisigExecutionDetailsBuilder().build();
    multisigExecutionDetailsMapper.mapMultisigExecutionDetails.mockResolvedValue(
      multisigExecutionDetails,
    );
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(true);
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue({});
    const to = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(to);

    const actual = await mapper.mapDetails(chainId, transaction, safe);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded: transaction.dataDecoded,
        to,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget: true,
        addressInfoIndex: null,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: multisigExecutionDetails,
      safeAppInfo,
    });
  });

  it('should return a TransactionDetails object with non-null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus = faker.helpers.objectValue(TransactionStatus);
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const safeAppInfo = safeAppInfoBuilder().build();
    safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(safeAppInfo);
    const multisigExecutionDetails = multisigExecutionDetailsBuilder().build();
    multisigExecutionDetailsMapper.mapMultisigExecutionDetails.mockResolvedValue(
      multisigExecutionDetails,
    );
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(true);
    const addressInfoIndex = {
      [faker.string.sample()]: addressInfoBuilder().build(),
      [faker.string.sample()]: addressInfoBuilder().build(),
    };
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue(
      addressInfoIndex,
    );
    const to = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(to);

    const actual = await mapper.mapDetails(chainId, transaction, safe);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded: transaction.dataDecoded,
        to,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget: true,
        addressInfoIndex,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: multisigExecutionDetails,
      safeAppInfo,
    });
  });
});
