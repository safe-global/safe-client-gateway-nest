import { faker } from '@faker-js/faker';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { transferTransactionInfoBuilder } from '../../entities/__tests__/transfer-transaction-info.builder';
import { TransferDetailsMapper } from './transfer-details.mapper';
import { TransferInfoMapper } from './transfer-info.mapper';

const transferInfoMapper = jest.mocked({
  mapTransferInfo: jest.fn(),
} as unknown as TransferInfoMapper);

describe('TransferDetails mapper (Unit)', () => {
  let mapper: TransferDetailsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new TransferDetailsMapper(transferInfoMapper);
  });

  it('should return a TransactionDetails object', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc20TransferBuilder().build();
    const safe = safeBuilder().build();
    const transferInfo = transferTransactionInfoBuilder().build();
    transferInfoMapper.mapTransferInfo.mockResolvedValue(transferInfo);

    const actual = await mapper.mapDetails(chainId, transfer, safe);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `transfer_${safe.address}_${transfer.transferId}`,
      executedAt: transfer.executionDate.getTime(),
      txStatus: 'SUCCESS',
      txInfo: transferInfo,
      txData: null,
      detailedExecutionInfo: null,
      txHash: transfer.transactionHash,
      safeAppInfo: null,
    });
  });
});
