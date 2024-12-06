import { faker } from '@faker-js/faker';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { SafeRepository } from '@/domain/safe/safe.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { TokenRepository } from '@/domain/tokens/token.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MultisigConfirmationDetails } from '@/routes/transactions/entities/transaction-details/multisig-execution-details.entity';
import { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { getAddress } from 'viem';
import { SafeTypedDataHelper } from '@/domain/contracts/safe-typed-data.helper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

const safeRepository = jest.mocked({
  getMultisigTransactions: jest.fn(),
} as jest.MockedObjectDeep<SafeRepository>);

const loggingService = jest.mocked({
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('MultisigTransactionExecutionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionDetailsMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    const safeTypedDataHelper = new SafeTypedDataHelper();
    mapper = new MultisigTransactionExecutionDetailsMapper(
      addressInfoHelper,
      tokenRepository,
      safeRepository,
      loggingService,
      safeTypedDataHelper,
    );
  });

  it('should return a MultisigExecutionDetails object with gasToken, empty confirmations and empty rejections', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('confirmations', [])
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', []).build(),
    );
    const gasTokenInfo = tokenBuilder().build();
    tokenRepository.getToken.mockResolvedValue(gasTokenInfo);

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        submittedAt: transaction.submissionDate.getTime(),
        nonce: transaction.nonce,
        safeTxGas: transaction.safeTxGas?.toString(),
        baseGas: transaction.baseGas?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        gasToken: transaction.gasToken,
        refundReceiver: addressInfo,
        safeTxHash: transaction.safeTxHash,
        domainHash: expect.any(String),
        messageHash: expect.any(String),
        executor: addressInfo,
        signers: safe.owners.map((owner) => new AddressInfo(owner)),
        confirmationsRequired: transaction.confirmationsRequired,
        confirmations: [],
        rejectors: [],
        gasTokenInfo,
        trusted: transaction.trusted,
        proposer: new AddressInfo(transaction.proposer!),
        proposedByDelegate: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with NULL_ADDRESS gasToken, confirmations and rejections', async () => {
    const chainId = faker.string.numeric();
    const transactionConfirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('gasToken', NULL_ADDRESS)
      .with('confirmations', transactionConfirmations)
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const rejectionTxConfirmation = confirmationBuilder().build();
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', [rejectionTxConfirmation])
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', [rejectionTx]).build(),
    );
    const expectedConfirmationsDetails = [
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[0].owner),
        transactionConfirmations[0].signature,
        transactionConfirmations[0].submissionDate.getTime(),
      ),
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[1].owner),
        transactionConfirmations[1].signature,
        transactionConfirmations[1].submissionDate.getTime(),
      ),
    ];
    const expectedRejectors = [new AddressInfo(rejectionTxConfirmation.owner)];

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        submittedAt: transaction.submissionDate.getTime(),
        nonce: transaction.nonce,
        safeTxGas: transaction.safeTxGas?.toString(),
        baseGas: transaction.baseGas?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        gasToken: NULL_ADDRESS,
        refundReceiver: addressInfo,
        safeTxHash: transaction.safeTxHash,
        domainHash: expect.any(String),
        messageHash: expect.any(String),
        executor: addressInfo,
        signers: safe.owners.map((owner) => new AddressInfo(owner)),
        confirmationsRequired: transaction.confirmationsRequired,
        confirmations: expectedConfirmationsDetails,
        rejectors: expectedRejectors,
        gasTokenInfo: null,
        trusted: transaction.trusted,
        proposer: new AddressInfo(transaction.proposer!),
        proposedByDelegate: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with rejectors from rejection transaction only', async () => {
    const chainId = faker.string.numeric();
    const transactionConfirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('gasToken', NULL_ADDRESS)
      .with('confirmations', transactionConfirmations)
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const rejectionTxConfirmation = confirmationBuilder().build();
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', [rejectionTxConfirmation])
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>()
        .with('results', [transaction, rejectionTx]) // returns both rejected and rejection txs
        .build(),
    );
    const expectedConfirmationsDetails = [
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[0].owner),
        transactionConfirmations[0].signature,
        transactionConfirmations[0].submissionDate.getTime(),
      ),
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[1].owner),
        transactionConfirmations[1].signature,
        transactionConfirmations[1].submissionDate.getTime(),
      ),
    ];
    const expectedRejectors = [new AddressInfo(rejectionTxConfirmation.owner)];

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        submittedAt: transaction.submissionDate.getTime(),
        nonce: transaction.nonce,
        safeTxGas: transaction.safeTxGas?.toString(),
        baseGas: transaction.baseGas?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        gasToken: NULL_ADDRESS,
        refundReceiver: addressInfo,
        safeTxHash: transaction.safeTxHash,
        domainHash: expect.any(String),
        messageHash: expect.any(String),
        executor: addressInfo,
        signers: safe.owners.map((owner) => new AddressInfo(owner)),
        confirmationsRequired: transaction.confirmationsRequired,
        confirmations: expectedConfirmationsDetails,
        rejectors: expectedRejectors,
        gasTokenInfo: null,
        trusted: transaction.trusted,
        proposer: new AddressInfo(transaction.proposer!),
        proposedByDelegate: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with no proposer if not present', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('proposer', null)
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', []).build(),
    );
    const gasTokenInfo = tokenBuilder().build();
    tokenRepository.getToken.mockResolvedValue(gasTokenInfo);

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        proposer: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object proposedByDelegate if not present', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const delegate = getAddress(faker.finance.ethereumAddress());
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('proposer', delegate)
      .with('proposedByDelegate', delegate)
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', []).build(),
    );
    const gasTokenInfo = tokenBuilder().build();
    tokenRepository.getToken.mockResolvedValue(gasTokenInfo);

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        proposedByDelegate: new AddressInfo(delegate),
      }),
    );
  });

  it('should return null domainHash if safe version is null', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().with('version', null).build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', []).build(),
    );

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        domainHash: null,
      }),
    );
  });

  it.each([
    'data' as const,
    'safeTxGas' as const,
    'baseGas' as const,
    'gasPrice' as const,
    'gasToken' as const,
    'refundReceiver' as const,
  ])(
    'should return null SafeTx message hash if transaction %s is null',
    async (field) => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().with('version', null).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with(field, null)
        .build();
      safeRepository.getMultisigTransactions.mockResolvedValue(
        pageBuilder<MultisigTransaction>().with('results', []).build(),
      );

      const actual = await mapper.mapMultisigExecutionDetails(
        chainId,
        transaction,
        safe,
      );

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'MULTISIG',
          messageHash: null,
        }),
      );
    },
  );

  it('should return null SafeTx hash if safe version is null', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().with('version', null).build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', []).build(),
    );

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        messageHash: null,
      }),
    );
  });
});
