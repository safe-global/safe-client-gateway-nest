import { faker } from '@faker-js/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { TransactionApi } from '@/datasources/transaction-api/transaction-api.service';
import { backboneBuilder } from '@/domain/backbone/entities/__tests__/backbone.builder';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { singletonBuilder } from '@/domain/chains/entities/__tests__/singleton.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { moduleTransactionBuilder } from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { creationTransactionBuilder } from '@/domain/safe/entities/__tests__/creation-transaction.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import { proposeTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/propose-transaction.dto.builder';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { DeviceType } from '@/domain/notifications/v1/entities/device.entity';
import { getAddress } from 'viem';
import type { ILoggingService } from '@/logging/logging.interface';
import { indexingStatusBuilder } from '@/domain/chains/entities/__tests__/indexing-status.builder';
import { fakeJson } from '@/__tests__/faker';
import { rawify } from '@/validation/entities/raw.entity';

const dataSource = {
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>;
const mockDataSource = jest.mocked(dataSource);

const cacheService = {
  deleteByKey: jest.fn(),
  hSet: jest.fn(),
  hGet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>;
const mockCacheService = jest.mocked(cacheService);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

const networkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);
const mockNetworkService = jest.mocked(networkService);

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('TransactionApi', () => {
  const chainId = '1';
  const baseUrl = faker.internet.url({ appendSlash: false });
  let httpErrorFactory: HttpErrorFactory;
  let service: TransactionApi;
  let defaultExpirationTimeInSeconds: number;
  let indexingExpirationTimeInSeconds: number;
  let notFoundExpireTimeSeconds: number;
  let ownersTtlSeconds: number;

  beforeEach(() => {
    jest.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    defaultExpirationTimeInSeconds = faker.number.int();
    indexingExpirationTimeInSeconds = faker.number.int();
    notFoundExpireTimeSeconds = faker.number.int();
    ownersTtlSeconds = faker.number.int();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') {
        return defaultExpirationTimeInSeconds;
      }
      if (key === 'expirationTimeInSeconds.indexing') {
        return indexingExpirationTimeInSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.default') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.contract') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.token') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'owners.ownersTtlSeconds') {
        return ownersTtlSeconds;
      }
      throw Error(`Unexpected key: ${key}`);
    });

    service = new TransactionApi(
      chainId,
      baseUrl,
      mockDataSource,
      mockCacheService,
      mockConfigurationService,
      httpErrorFactory,
      mockNetworkService,
      mockLoggingService,
    );
  });

  describe('getDataDecoded', () => {
    it('should return the decoded data', async () => {
      const data = faker.string.hexadecimal() as `0x${string}`;
      const to = getAddress(faker.finance.ethereumAddress());
      const getDataDecodedUrl = `${baseUrl}/api/v1/data-decoder/`;
      const decodedData = dataDecodedBuilder().build();
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify(decodedData),
      });

      const actual = await service.getDataDecoded({ data, to });

      expect(actual).toBe(decodedData);
      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: getDataDecodedUrl,
        data: {
          data,
          to,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const data = faker.string.hexadecimal() as `0x${string}`;
      const to = getAddress(faker.finance.ethereumAddress());
      const getDataDecodedUrl = `${baseUrl}/api/v1/data-decoder/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDataDecodedUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getDataDecoded({ data, to })).rejects.toThrow(
        expected,
      );

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: getDataDecodedUrl,
        data: {
          data,
          to,
        },
      });
    });
  });

  describe('getBackbone', () => {
    it('should return the backbone retrieved', async () => {
      const data = backboneBuilder().build();
      const getBackboneUrl = `${baseUrl}/api/v1/about`;
      const cacheDir = new CacheDir(`${chainId}_backbone`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(data));

      const actual = await service.getBackbone();

      expect(actual).toBe(data);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getBackboneUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const getBackboneUrl = `${baseUrl}/api/v1/about`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_backbone`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getBackboneUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getBackbone()).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getBackboneUrl,
      });
    });
  });

  describe('getSingletons', () => {
    it('should return the singletons received', async () => {
      const singletons = [singletonBuilder().build()];
      const getSingletonsUrl = `${baseUrl}/api/v1/about/singletons/`;
      const cacheDir = new CacheDir(`${chainId}_singletons`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(singletons));

      const actual = await service.getSingletons();

      expect(actual).toBe(singletons);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getSingletonsUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const getSingletonsUrl = `${baseUrl}/api/v1/about/singletons/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_singletons`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getSingletonsUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getSingletons()).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getSingletonsUrl,
      });
    });
  });

  describe('getIndexingStatus', () => {
    it('should return the indexing status received', async () => {
      const indexingStatus = indexingStatusBuilder().build();
      const getIndexingStatusUrl = `${baseUrl}/api/v1/about/indexing/`;
      const cacheDir = new CacheDir(`${chainId}_indexing`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(indexingStatus));

      const actual = await service.getIndexingStatus();

      expect(actual).toBe(indexingStatus);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: indexingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getIndexingStatusUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const getIndexingStatusUrl = `${baseUrl}/api/v1/about/indexing/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_indexing`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getIndexingStatusUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );
      await expect(service.getIndexingStatus()).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: indexingExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getIndexingStatusUrl,
      });
    });
  });

  describe('getSafe', () => {
    it('should return retrieved safe', async () => {
      const safe = safeBuilder().build();
      const getSafeUrl = `${baseUrl}/api/v1/safes/${safe.address}`;
      const cacheDir = new CacheDir(`${chainId}_safe_${safe.address}`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(safe));

      const actual = await service.getSafe(safe.address);

      expect(actual).toBe(safe);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getSafeUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safe = safeBuilder().build();
      const getSafeUrl = `${baseUrl}/api/v1/safes/${safe.address}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_safe_${safe.address}`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getSafeUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getSafe(safe.address)).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getSafeUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
    });
  });

  describe('clearSafe', () => {
    it('should clear the Safe cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearSafe(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_safe_${safeAddress}`,
      );
    });
  });

  describe('isSafe', () => {
    it('should return whether Safe exists', async () => {
      const safe = safeBuilder().build();
      const cacheDir = new CacheDir(
        `${chainId}_safe_exists_${safe.address}`,
        '',
      );
      cacheService.hGet.mockResolvedValueOnce(undefined);
      networkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(safe),
      });

      const actual = await service.isSafe(safe.address);

      expect(actual).toBe(true);
      expect(cacheService.hGet).toHaveBeenCalledTimes(1);
      expect(cacheService.hGet).toHaveBeenCalledWith(cacheDir);
      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/api/v1/safes/${safe.address}`,
      });
      expect(cacheService.hSet).toHaveBeenCalledTimes(1);
      expect(cacheService.hSet).toHaveBeenCalledWith(
        cacheDir,
        'true',
        Number.MAX_SAFE_INTEGER - 1,
      );
    });

    it('should return the cached value', async () => {
      const safe = safeBuilder().build();
      const cacheDir = new CacheDir(
        `${chainId}_safe_exists_${safe.address}`,
        '',
      );
      const isSafe = faker.datatype.boolean();
      cacheService.hGet.mockResolvedValueOnce(JSON.stringify(isSafe));
      networkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(safe),
      });

      const actual = await service.isSafe(safe.address);

      expect(actual).toBe(isSafe);
      expect(cacheService.hGet).toHaveBeenCalledTimes(1);
      expect(cacheService.hGet).toHaveBeenCalledWith(cacheDir);
      expect(networkService.get).not.toHaveBeenCalled();
      expect(cacheService.hSet).not.toHaveBeenCalledTimes(1);
    });

    it('should return false if Safe does not exist', async () => {
      const safe = safeBuilder().build();
      const cacheDir = new CacheDir(
        `${chainId}_safe_exists_${safe.address}`,
        '',
      );
      cacheService.hGet.mockResolvedValueOnce(undefined);
      networkService.get.mockResolvedValueOnce({
        status: 404,
        data: rawify(null),
      });

      const actual = await service.isSafe(safe.address);

      expect(actual).toBe(false);
      expect(cacheService.hGet).toHaveBeenCalledTimes(1);
      expect(cacheService.hGet).toHaveBeenCalledWith(cacheDir);
      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/api/v1/safes/${safe.address}`,
      });
      expect(cacheService.hSet).toHaveBeenCalledTimes(1);
      expect(cacheService.hSet).toHaveBeenCalledWith(
        cacheDir,
        'false',
        defaultExpirationTimeInSeconds,
      );
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safe = safeBuilder().build();
      const getSafeUrl = `${baseUrl}/api/v1/safes/${safe.address}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_safe_exists_${safe.address}`,
        '',
      );
      cacheService.hGet.mockResolvedValueOnce(undefined);
      networkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getSafeUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.isSafe(safe.address)).rejects.toThrow(expected);

      expect(cacheService.hGet).toHaveBeenCalledTimes(1);
      expect(cacheService.hGet).toHaveBeenCalledWith(cacheDir);
      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/api/v1/safes/${safe.address}`,
      });
      expect(cacheService.hSet).not.toHaveBeenCalled();
    });
  });

  describe('clearIsSafe', () => {
    it('should clear the Safe existence cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearIsSafe(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_safe_exists_${safeAddress}`,
      );
    });
  });

  describe('getContract', () => {
    it('should return retrieved contract', async () => {
      const contract = contractBuilder().build();
      const getContractUrl = `${baseUrl}/api/v1/contracts/${contract.address}`;
      const cacheDir = new CacheDir(
        `${chainId}_contract_${contract.address}`,
        '',
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(contract));

      const actual = await service.getContract(contract.address);

      expect(actual).toBe(contract);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getContractUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const contract = getAddress(faker.finance.ethereumAddress());
      const getContractUrl = `${baseUrl}/api/v1/contracts/${contract}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_contract_${contract}`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getContractUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getContract(contract)).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getContractUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
    });
  });

  describe('getDelegates', () => {
    it('should return retrieved delegates', async () => {
      const delegate = delegateBuilder().build();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const delegatesPage = pageBuilder().with('results', [delegate]).build();
      const getDelegatesUrl = `${baseUrl}/api/v1/delegates/`;
      const cacheDir = new CacheDir(
        `${chainId}_delegates_${delegate.safe}`,
        `${delegate.delegate}_${delegate.delegator}_${delegate.label}_${limit}_${offset}`,
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(delegatesPage));

      const actual = await service.getDelegates({
        ...delegate,
        safeAddress: delegate.safe!,
        limit,
        offset,
      });

      expect(actual).toBe(delegatesPage);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getDelegatesUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        networkRequest: {
          params: {
            ...delegate,
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const delegate = delegateBuilder().build();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getDelegatesUrl = `${baseUrl}/api/v1/delegates/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_delegates_${delegate.safe}`,
        `${delegate.delegate}_${delegate.delegator}_${delegate.label}_${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getDelegatesUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getDelegates({
          ...delegate,
          safeAddress: delegate.safe!,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getDelegatesUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        networkRequest: {
          params: {
            ...delegate,
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('postDelegate', () => {
    it('should post delegate', async () => {
      const delegate = delegateBuilder().build();
      const signature = faker.string.hexadecimal();
      const postDelegateUrl = `${baseUrl}/api/v1/delegates/`;
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.postDelegate({
        ...delegate,
        safeAddress: delegate.safe!,
        signature,
      });

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postDelegateUrl,
        data: {
          ...delegate,
          signature,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const delegate = delegateBuilder().build();
      const signature = faker.string.hexadecimal();
      const postDelegateUrl = `${baseUrl}/api/v1/delegates/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(postDelegateUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.postDelegate({
          ...delegate,
          safeAddress: delegate.safe!,
          signature,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postDelegateUrl,
        data: {
          ...delegate,
          signature,
        },
      });
    });
  });

  describe('deleteDelegate', () => {
    it('should delete delegate', async () => {
      const delegate = delegateBuilder().build();
      const signature = faker.string.hexadecimal();
      const deleteDelegateUrl = `${baseUrl}/api/v1/delegates/${delegate.delegate}`;
      networkService.delete.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.deleteDelegate({
        delegate: delegate.delegate,
        delegator: delegate.delegator,
        signature,
      });

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteDelegateUrl,
        data: {
          delegate: delegate.delegate,
          delegator: delegate.delegator,
          signature,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const delegate = delegateBuilder().build();
      const signature = faker.string.hexadecimal();
      const deleteDelegateUrl = `${baseUrl}/api/v1/delegates/${delegate.delegate}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.delete.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(deleteDelegateUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.deleteDelegate({
          delegate: delegate.delegate,
          delegator: delegate.delegator,
          signature,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteDelegateUrl,
        data: {
          delegate: delegate.delegate,
          delegator: delegate.delegator,
          signature,
        },
      });
    });
  });

  describe('deleteSafeDelegate', () => {
    it('should delete Safe delegate', async () => {
      const delegate = delegateBuilder().build();
      const signature = faker.string.hexadecimal();
      const deleteSafeDelegateUrl = `${baseUrl}/api/v1/safes/${delegate.safe}/delegates/${delegate.delegate}`;
      networkService.delete.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.deleteSafeDelegate({
        delegate: delegate.delegate,
        safeAddress: delegate.safe!,
        signature,
      });

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteSafeDelegateUrl,
        data: {
          delegate: delegate.delegate,
          safe: delegate.safe!,
          signature,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const delegate = delegateBuilder().build();
      const signature = faker.string.hexadecimal();
      const deleteSafeDelegateUrl = `${baseUrl}/api/v1/safes/${delegate.safe}/delegates/${delegate.delegate}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.delete.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(deleteSafeDelegateUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.deleteSafeDelegate({
          delegate: delegate.delegate,
          safeAddress: delegate.safe!,
          signature,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteSafeDelegateUrl,
        data: {
          delegate: delegate.delegate,
          safe: delegate.safe!,
          signature,
        },
      });
    });
  });

  describe('getTransfer', () => {
    it('should return the transfer retrieved', async () => {
      const transfer = erc20TransferBuilder().build();
      const getTransferUrl = `${baseUrl}/api/v1/transfer/${transfer.transferId}`;
      const cacheDir = new CacheDir(
        `${chainId}_transfer_${transfer.transferId}`,
        '',
      );
      networkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(transfer),
      });

      const actual = await service.getTransfer(transfer.transferId);

      expect(actual).toBe(actual);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTransferUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const transferId = faker.string.hexadecimal();
      const getTransferUrl = `${baseUrl}/api/v1/transfer/${transferId}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_transfer_${transferId}`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getTransferUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getTransfer(transferId)).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTransferUrl,
      });
    });
  });

  describe('getTransfers', () => {
    it('should return the transfers retrieved', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const onlyErc20 = faker.datatype.boolean();
      const onlyErc721 = faker.datatype.boolean();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const transfer = erc20TransferBuilder().build();
      const transfersPage = pageBuilder().with('results', [transfer]).build();
      const getTransfersUrl = `${baseUrl}/api/v1/safes/${safeAddress}/transfers/`;
      const cacheDir = new CacheDir(
        `${chainId}_transfers_${safeAddress}`,
        `${onlyErc20}_${onlyErc721}_${limit}_${offset}`,
      );
      networkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(transfersPage),
      });

      const actual = await service.getTransfers({
        safeAddress,
        onlyErc20,
        onlyErc721,
        limit,
        offset,
      });

      expect(actual).toBe(actual);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTransfersUrl,
        networkRequest: {
          params: {
            erc20: onlyErc20,
            erc721: onlyErc721,
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const onlyErc20 = faker.datatype.boolean();
      const onlyErc721 = faker.datatype.boolean();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getTransfersUrl = `${baseUrl}/api/v1/safes/${safeAddress}/transfers/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_transfers_${safeAddress}`,
        `${onlyErc20}_${onlyErc721}_${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getTransfersUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getTransfers({
          safeAddress,
          onlyErc20,
          onlyErc721,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTransfersUrl,
        networkRequest: {
          params: {
            erc20: onlyErc20,
            erc721: onlyErc721,
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('clearTransfers', () => {
    it('should clear the transfers cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearTransfers(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_transfers_${safeAddress}`,
      );
    });
  });

  describe('getIncomingTransfers', () => {
    it('should return the incoming transfers retrieved', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const executionDateGte = faker.date.recent().toISOString();
      const executionDateLte = faker.date.recent().toISOString();
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const tokenAddress = getAddress(faker.finance.ethereumAddress());
      const txHash = faker.string.hexadecimal();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const incomingTransfer = erc20TransferBuilder()
        .with('to', getAddress(safeAddress))
        .build();
      const incomingTransfersPage = pageBuilder()
        .with('results', [incomingTransfer])
        .build();
      const getIncomingTransfersUrl = `${baseUrl}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      const cacheDir = new CacheDir(
        `${chainId}_incoming_transfers_${safeAddress}`,
        `${executionDateGte}_${executionDateLte}_${to}_${value}_${tokenAddress}_${txHash}_${limit}_${offset}`,
      );
      networkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(incomingTransfersPage),
      });

      const actual = await service.getIncomingTransfers({
        safeAddress,
        executionDateGte,
        executionDateLte,
        to,
        value,
        tokenAddress,
        limit,
        offset,
        txHash,
      });

      expect(actual).toBe(actual);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getIncomingTransfersUrl,
        networkRequest: {
          params: {
            execution_date__gte: executionDateGte,
            execution_date__lte: executionDateLte,
            to,
            value,
            token_address: tokenAddress,
            limit,
            offset,
            transaction_hash: txHash,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const executionDateGte = faker.date.recent().toISOString();
      const executionDateLte = faker.date.recent().toISOString();
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const tokenAddress = getAddress(faker.finance.ethereumAddress());
      const txHash = faker.string.hexadecimal();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getIncomingTransfersUrl = `${baseUrl}/api/v1/safes/${safeAddress}/incoming-transfers/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_incoming_transfers_${safeAddress}`,
        `${executionDateGte}_${executionDateLte}_${to}_${value}_${tokenAddress}_${txHash}_${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getIncomingTransfersUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getIncomingTransfers({
          safeAddress,
          executionDateGte,
          executionDateLte,
          to,
          value,
          tokenAddress,
          txHash,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getIncomingTransfersUrl,
        networkRequest: {
          params: {
            execution_date__gte: executionDateGte,
            execution_date__lte: executionDateLte,
            to,
            value,
            token_address: tokenAddress,
            transaction_hash: txHash,
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('clearIncomingTransfers', () => {
    it('should clear the incoming transfers cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearIncomingTransfers(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_incoming_transfers_${safeAddress}`,
      );
    });
  });

  describe('postConfirmation', () => {
    it('should post confirmation', async () => {
      const safeTxHash = faker.string.hexadecimal();
      const signedSafeTxHash = faker.string.hexadecimal();
      const postConfirmationUrl = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.postConfirmation({
        safeTxHash,
        addConfirmationDto: { signedSafeTxHash },
      });

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postConfirmationUrl,
        data: {
          signature: signedSafeTxHash,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeTxHash = faker.string.hexadecimal();
      const signedSafeTxHash = faker.string.hexadecimal();
      const postConfirmationUrl = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(postConfirmationUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.postConfirmation({
          safeTxHash,
          addConfirmationDto: { signedSafeTxHash },
        }),
      ).rejects.toThrow(expected);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postConfirmationUrl,
        data: {
          signature: signedSafeTxHash,
        },
      });
    });
  });

  describe('getSafesByModules', () => {
    it('should return Safes with module enabled', async () => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const safesByModule = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };
      const getSafesByModuleUrl = `${baseUrl}/api/v1/modules/${moduleAddress}/safes/`;
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(safesByModule),
        status: 200,
      });

      const actual = await service.getSafesByModule(moduleAddress);

      expect(actual).toBe(safesByModule);
      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: getSafesByModuleUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const getSafesByModuleUrl = `${baseUrl}/api/v1/modules/${moduleAddress}/safes/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      mockNetworkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getSafesByModuleUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getSafesByModule(moduleAddress)).rejects.toThrow(
        expected,
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: getSafesByModuleUrl,
      });
    });
  });

  describe('getModuleTransaction', () => {
    it('should return the module transaction retrieved', async () => {
      const moduleTransactionId = faker.string.hexadecimal();
      const moduleTransaction = moduleTransactionBuilder().build();
      const getModuleTransactionUrl = `${baseUrl}/api/v1/module-transaction/${moduleTransactionId}`;
      const cacheDir = new CacheDir(
        `${chainId}_module_transaction_${moduleTransactionId}`,
        '',
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(moduleTransaction));

      const actual = await service.getModuleTransaction(moduleTransactionId);

      expect(actual).toBe(moduleTransaction);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getModuleTransactionUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const moduleTransactionId = faker.string.hexadecimal();
      const getModuleTransactionUrl = `${baseUrl}/api/v1/module-transaction/${moduleTransactionId}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_module_transaction_${moduleTransactionId}`,
        '',
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getModuleTransactionUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getModuleTransaction(moduleTransactionId),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getModuleTransactionUrl,
      });
    });
  });

  describe('getModuleTransactions', () => {
    it('should return the module transactions retrieved', async () => {
      const moduleTransaction = moduleTransactionBuilder().build();
      const moduleTransactionsPage = pageBuilder()
        .with('results', [moduleTransaction])
        .build();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getModuleTransactionsUrl = `${baseUrl}/api/v1/safes/${moduleTransaction.safe}/module-transactions/`;
      const cacheDir = new CacheDir(
        `${chainId}_module_transactions_${moduleTransaction.safe}`,
        `${moduleTransaction.to}_${moduleTransaction.module}_${moduleTransaction.transactionHash}_${limit}_${offset}`,
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(moduleTransactionsPage));

      const actual = await service.getModuleTransactions({
        safeAddress: moduleTransaction.safe,
        to: moduleTransaction.to,
        module: moduleTransaction.module,
        txHash: moduleTransaction.transactionHash,
        limit,
        offset,
      });

      expect(actual).toBe(moduleTransactionsPage);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getModuleTransactionsUrl,
        networkRequest: {
          params: {
            to: moduleTransaction.to,
            module: moduleTransaction.module,
            transaction_hash: moduleTransaction.transactionHash,
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const moduleTransaction = moduleTransactionBuilder().build();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getModuleTransactionsUrl = `${baseUrl}/api/v1/safes/${moduleTransaction.safe}/module-transactions/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_module_transactions_${moduleTransaction.safe}`,
        `${moduleTransaction.to}_${moduleTransaction.module}_${moduleTransaction.transactionHash}_${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getModuleTransactionsUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getModuleTransactions({
          safeAddress: moduleTransaction.safe,
          to: moduleTransaction.to,
          module: moduleTransaction.module,
          txHash: moduleTransaction.transactionHash,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getModuleTransactionsUrl,
        networkRequest: {
          params: {
            to: moduleTransaction.to,
            module: moduleTransaction.module,
            transaction_hash: moduleTransaction.transactionHash,
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('clearModuleTransactions', () => {
    it('should clear the module transactions cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearModuleTransactions(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_module_transactions_${safeAddress}`,
      );
    });
  });

  describe('getMultisigTransactions', () => {
    it('should return the multisig transactions retrieved', async () => {
      const multisigTransaction = multisigTransactionBuilder().build();
      const multisigTransactionsPage = pageBuilder()
        .with('results', [multisigTransaction])
        .build();
      const ordering = faker.word.noun();
      const executedDateGte = faker.date.recent().toISOString();
      const executedDateLte = faker.date.recent().toISOString();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getMultisigTransactionsUrl = `${baseUrl}/api/v1/safes/${multisigTransaction.safe}/multisig-transactions/`;
      const cacheDir = new CacheDir(
        `${chainId}_multisig_transactions_${multisigTransaction.safe}`,
        `${ordering}_${multisigTransaction.isExecuted}_${multisigTransaction.trusted}_${executedDateGte}_${executedDateLte}_${multisigTransaction.to}_${multisigTransaction.value}_${multisigTransaction.nonce}_${multisigTransaction.nonce}_${limit}_${offset}`,
      );
      mockDataSource.get.mockResolvedValueOnce(
        rawify(multisigTransactionsPage),
      );

      const actual = await service.getMultisigTransactions({
        safeAddress: multisigTransaction.safe,
        ordering,
        executed: multisigTransaction.isExecuted,
        trusted: multisigTransaction.trusted,
        executionDateGte: executedDateGte,
        executionDateLte: executedDateLte,
        to: multisigTransaction.to,
        value: multisigTransaction.value,
        nonce: multisigTransaction.nonce.toString(),
        nonceGte: multisigTransaction.nonce,
        limit,
        offset,
      });

      expect(actual).toStrictEqual(multisigTransactionsPage);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMultisigTransactionsUrl,
        networkRequest: {
          params: {
            safe: multisigTransaction.safe,
            ordering,
            executed: multisigTransaction.isExecuted,
            trusted: multisigTransaction.trusted,
            execution_date__gte: executedDateGte,
            execution_date__lte: executedDateLte,
            to: multisigTransaction.to,
            value: multisigTransaction.value,
            nonce: multisigTransaction.nonce.toString(),
            nonce__gte: multisigTransaction.nonce,
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const multisigTransaction = multisigTransactionBuilder().build();
      const ordering = faker.word.noun();
      const executedDateGte = faker.date.recent().toISOString();
      const executedDateLte = faker.date.recent().toISOString();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getMultisigTransactionsUrl = `${baseUrl}/api/v1/safes/${multisigTransaction.safe}/multisig-transactions/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_multisig_transactions_${multisigTransaction.safe}`,
        `${ordering}_${multisigTransaction.isExecuted}_${multisigTransaction.trusted}_${executedDateGte}_${executedDateLte}_${multisigTransaction.to}_${multisigTransaction.value}_${multisigTransaction.nonce}_${multisigTransaction.nonce}_${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getMultisigTransactionsUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getMultisigTransactions({
          safeAddress: multisigTransaction.safe,
          ordering,
          executed: multisigTransaction.isExecuted,
          trusted: multisigTransaction.trusted,
          executionDateGte: executedDateGte,
          executionDateLte: executedDateLte,
          to: multisigTransaction.to,
          value: multisigTransaction.value,
          nonce: multisigTransaction.nonce.toString(),
          nonceGte: multisigTransaction.nonce,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMultisigTransactionsUrl,
        networkRequest: {
          params: {
            safe: multisigTransaction.safe,
            ordering,
            executed: multisigTransaction.isExecuted,
            trusted: multisigTransaction.trusted,
            execution_date__gte: executedDateGte,
            execution_date__lte: executedDateLte,
            to: multisigTransaction.to,
            value: multisigTransaction.value,
            nonce: multisigTransaction.nonce.toString(),
            nonce__gte: multisigTransaction.nonce,
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('clearMultisigTransactions', () => {
    it('should clear the multisig transactions cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearMultisigTransactions(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_multisig_transactions_${safeAddress}`,
      );
    });
  });

  describe('getMultisigTransaction', () => {
    it('should return the multisig transaction retrieved', async () => {
      const multisigTransaction = multisigTransactionBuilder().build();
      const getMultisigTransactionUrl = `${baseUrl}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
      const cacheDir = new CacheDir(
        `${chainId}_multisig_transaction_${multisigTransaction.safeTxHash}`,
        '',
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(multisigTransaction));

      const actual = await service.getMultisigTransaction(
        multisigTransaction.safeTxHash,
      );

      expect(actual).toBe(multisigTransaction);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMultisigTransactionUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const multisigTransaction = multisigTransactionBuilder().build();
      const getMultisigTransactionUrl = `${baseUrl}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_multisig_transaction_${multisigTransaction.safeTxHash}`,
        '',
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getMultisigTransactionUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getMultisigTransaction(multisigTransaction.safeTxHash),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMultisigTransactionUrl,
      });
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a transaction', async () => {
      const safeTxHash = faker.string.hexadecimal();
      const signature = faker.string.hexadecimal();
      const deleteTransactionUrl = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}`;
      networkService.delete.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.deleteTransaction({
        safeTxHash,
        signature,
      });

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteTransactionUrl,
        data: {
          signature,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeTxHash = faker.string.hexadecimal();
      const signature = faker.string.hexadecimal();
      const deleteTransactionUrl = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.delete.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(deleteTransactionUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.deleteTransaction({
          safeTxHash,
          signature,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteTransactionUrl,
        data: {
          signature,
        },
      });
    });
  });

  describe('clearMultisigTransaction', () => {
    it('should clear the multisig transaction cache', async () => {
      const safeTxHash = faker.string.hexadecimal();

      await service.clearMultisigTransaction(safeTxHash);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_multisig_transaction_${safeTxHash}`,
      );
    });
  });

  describe('getCreationTransaction', () => {
    it('should return the creation transaction retrieved', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const creationTransaction = creationTransactionBuilder().build();
      const getCreationTransactionUrl = `${baseUrl}/api/v1/safes/${safeAddress}/creation/`;
      const cacheDir = new CacheDir(
        `${chainId}_creation_transaction_${safeAddress}`,
        '',
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(creationTransaction));

      const actual = await service.getCreationTransaction(safeAddress);

      expect(actual).toBe(creationTransaction);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getCreationTransactionUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const getCreationTransactionUrl = `${baseUrl}/api/v1/safes/${safeAddress}/creation/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_creation_transaction_${safeAddress}`,
        '',
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getCreationTransactionUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getCreationTransaction(safeAddress)).rejects.toThrow(
        expected,
      );

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getCreationTransactionUrl,
      });
    });
  });

  describe('getAllTransactions', () => {
    it('should return all transactions retrieved', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const ordering = faker.word.noun();
      const executed = faker.datatype.boolean();
      const queued = faker.datatype.boolean();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const multisigTransaction = multisigTransactionBuilder().build();
      const creationTransaction = creationTransactionBuilder().build();
      const allTransactionsPage = pageBuilder()
        .with('results', [multisigTransaction, creationTransaction])
        .build();
      const getAllTransactionsUrl = `${baseUrl}/api/v1/safes/${safeAddress}/all-transactions/`;
      const cacheDir = new CacheDir(
        `${chainId}_all_transactions_${safeAddress}`,
        `${ordering}_${executed}_${queued}_${limit}_${offset}`,
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(allTransactionsPage));

      const actual = await service.getAllTransactions({
        safeAddress,
        ordering,
        executed,
        queued,
        limit,
        offset,
      });

      expect(actual).toStrictEqual(allTransactionsPage);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getAllTransactionsUrl,
        networkRequest: {
          params: {
            safe: safeAddress,
            ordering,
            executed,
            queued,
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const ordering = faker.word.noun();
      const executed = faker.datatype.boolean();
      const queued = faker.datatype.boolean();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getAllTransactionsUrl = `${baseUrl}/api/v1/safes/${safeAddress}/all-transactions/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_all_transactions_${safeAddress}`,
        `${ordering}_${executed}_${queued}_${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getAllTransactionsUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getAllTransactions({
          safeAddress,
          ordering,
          executed,
          queued,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getAllTransactionsUrl,
        networkRequest: {
          params: {
            safe: safeAddress,
            ordering,
            executed,
            queued,
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('clearAllTransactions', () => {
    it('should clear the all transactions cache', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearAllTransactions(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_all_transactions_${safeAddress}`,
      );
    });
  });

  describe('getToken', () => {
    it('should return the token retrieved', async () => {
      const token = tokenBuilder().build();
      const getTokenUrl = `${baseUrl}/api/v1/tokens/${token.address}`;
      const cacheDir = new CacheDir(`${chainId}_token_${token.address}`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(token));

      const actual = await service.getToken(token.address);

      expect(actual).toBe(token);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTokenUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const token = tokenBuilder().build();
      const getTokenUrl = `${baseUrl}/api/v1/tokens/${token.address}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_token_${token.address}`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getTokenUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getToken(token.address)).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTokenUrl,
      });
    });
  });

  describe('getTokens', () => {
    it('should return the token retrieved', async () => {
      const token = tokenBuilder().build();
      const tokensPage = pageBuilder().with('results', [token]).build();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getTokensUrl = `${baseUrl}/api/v1/tokens/`;
      const cacheDir = new CacheDir(`${chainId}_tokens`, `${limit}_${offset}`);
      mockDataSource.get.mockResolvedValueOnce(rawify(tokensPage));

      const actual = await service.getTokens({
        limit,
        offset,
      });

      expect(actual).toBe(tokensPage);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTokensUrl,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getTokensUrl = `${baseUrl}/api/v1/tokens/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_tokens`, `${limit}_${offset}`);
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getTokensUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getTokens({
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getTokensUrl,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('getSafesByOwner', () => {
    it('should return retrieved safe', async () => {
      const owner = getAddress(faker.finance.ethereumAddress());
      const safeList = {
        safes: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };
      const getSafesByOwnerUrl = `${baseUrl}/api/v1/owners/${owner}/safes/`;
      const cacheDir = new CacheDir(`${chainId}_owner_safes_${owner}`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(safeList));

      const actual = await service.getSafesByOwner(owner);

      expect(actual).toBe(safeList);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getSafesByOwnerUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: ownersTtlSeconds,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const owner = getAddress(faker.finance.ethereumAddress());
      const getSafesByOwnerUrl = `${baseUrl}/api/v1/owners/${owner}/safes/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_owner_safes_${owner}`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getSafesByOwnerUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getSafesByOwner(owner)).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        url: getSafesByOwnerUrl,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: ownersTtlSeconds,
      });
    });
  });

  describe('postDeviceRegistration', () => {
    it('should post device registration', async () => {
      const device = {
        uuid: faker.string.uuid(),
        cloudMessagingToken: faker.string.uuid(),
        buildNumber: faker.system.semver(),
        deviceType: faker.helpers.enumValue(DeviceType),
        version: faker.system.semver(),
        timestamp: faker.date.recent().toISOString(),
        bundle: faker.word.noun(),
      };
      const safes = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const signatures = [
        faker.string.hexadecimal(),
        faker.string.hexadecimal(),
      ];
      const postDeviceRegistrationUrl = `${baseUrl}/api/v1/notifications/devices/`;
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.postDeviceRegistration({
        device,
        safes,
        signatures,
      });

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postDeviceRegistrationUrl,
        data: {
          ...device,
          safes,
          signatures,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeTxHash = faker.string.hexadecimal();
      const signedSafeTxHash = faker.string.hexadecimal();
      const postConfirmationUrl = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(postConfirmationUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.postConfirmation({
          safeTxHash,
          addConfirmationDto: { signedSafeTxHash },
        }),
      ).rejects.toThrow(expected);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postConfirmationUrl,
        data: {
          signature: signedSafeTxHash,
        },
      });
    });
  });

  describe('deleteDeviceRegistration', () => {
    it('should delete device registration', async () => {
      const uuid = faker.string.uuid();
      const deleteDeviceRegistrationUrl = `${baseUrl}/api/v1/notifications/devices/${uuid}`;
      networkService.delete.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.deleteDeviceRegistration(uuid);

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteDeviceRegistrationUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const uuid = faker.string.uuid();
      const deleteDeviceRegistrationUrl = `${baseUrl}/api/v1/notifications/devices/${uuid}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.delete.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(deleteDeviceRegistrationUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.deleteDeviceRegistration(uuid)).rejects.toThrow(
        expected,
      );

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteDeviceRegistrationUrl,
      });
    });
  });

  describe('deleteSafeRegistration', () => {
    it('should delete Safe registration', async () => {
      const uuid = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deleteSafeRegistrationUrl = `${baseUrl}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
      networkService.delete.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.deleteSafeRegistration({ uuid, safeAddress });

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteSafeRegistrationUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const uuid = faker.string.uuid();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const deleteSafeRegistrationUrl = `${baseUrl}/api/v1/notifications/devices/${uuid}/safes/${safeAddress}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.delete.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(deleteSafeRegistrationUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.deleteSafeRegistration({ uuid, safeAddress }),
      ).rejects.toThrow(expected);

      expect(networkService.delete).toHaveBeenCalledTimes(1);
      expect(networkService.delete).toHaveBeenCalledWith({
        url: deleteSafeRegistrationUrl,
      });
    });
  });

  describe('getEstimation', () => {
    it('should return the estimation received', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const data = faker.string.hexadecimal() as `0x${string}`;
      const operation = faker.helpers.arrayElement([0, 1] as const);
      const estimation = {
        safeTxGas: faker.string.numeric(),
      };
      const getEstimationUrl = `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/estimations/`;
      networkService.post.mockResolvedValueOnce({
        data: rawify(estimation),
        status: 200,
      });

      const actual = await service.getEstimation({
        address: safeAddress,
        getEstimationDto: { to, value, data, operation },
      });

      expect(actual).toBe(estimation);
      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: getEstimationUrl,
        data: {
          to,
          value,
          data,
          operation,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const data = faker.string.hexadecimal() as `0x${string}`;
      const operation = faker.helpers.arrayElement([0, 1] as const);
      const getEstimationUrl = `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/estimations/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getEstimationUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getEstimation({
          address: safeAddress,
          getEstimationDto: { to, value, data, operation },
        }),
      ).rejects.toThrow(expected);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: getEstimationUrl,
        data: {
          to,
          value,
          data,
          operation,
        },
      });
    });
  });

  describe('getMessageByHash', () => {
    it('should return the message hash received', async () => {
      const messageHash = faker.string.hexadecimal();
      const getMessageByHashUrl = `${baseUrl}/api/v1/messages/${messageHash}`;
      const message = messageBuilder().build();
      const cacheDir = new CacheDir(`${chainId}_message_${messageHash}`, '');
      mockDataSource.get.mockResolvedValueOnce(rawify(message));

      const actual = await service.getMessageByHash(messageHash);

      expect(actual).toBe(message);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMessageByHashUrl,
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const messageHash = faker.string.hexadecimal();
      const getMessageByHashUrl = `${baseUrl}/api/v1/messages/${messageHash}`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(`${chainId}_message_${messageHash}`, '');
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getMessageByHashUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(service.getMessageByHash(messageHash)).rejects.toThrow(
        expected,
      );

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMessageByHashUrl,
      });
    });
  });

  describe('getMessagesBySafe', () => {
    it('should return the message hash received', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getMessageBySafeUrl = `${baseUrl}/api/v1/safes/${safeAddress}/messages/`;
      const message = messageBuilder().build();
      const cacheDir = new CacheDir(
        `${chainId}_messages_${safeAddress}`,
        `${limit}_${offset}`,
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(message));

      const actual = await service.getMessagesBySafe({
        safeAddress,
        limit,
        offset,
      });

      expect(actual).toBe(message);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMessageBySafeUrl,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getMessageBySafeUrl = `${baseUrl}/api/v1/safes/${safeAddress}/messages/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      const cacheDir = new CacheDir(
        `${chainId}_messages_${safeAddress}`,
        `${limit}_${offset}`,
      );
      mockDataSource.get.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(getMessageBySafeUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.getMessagesBySafe({
          safeAddress,
          limit,
          offset,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        url: getMessageBySafeUrl,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });
  });

  describe('postMultisigTransaction', () => {
    it('should post multisig transaction', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const proposeTransactionDto = proposeTransactionDtoBuilder().build();
      const postMultisigTransactionUrl = `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.postMultisigTransaction({
        address: safeAddress,
        data: proposeTransactionDto,
      });

      const { safeTxHash, ...rest } = proposeTransactionDto;
      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postMultisigTransactionUrl,
        data: {
          ...rest,
          contractTransactionHash: safeTxHash,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const proposeTransactionDto = proposeTransactionDtoBuilder().build();
      const postMultisigTransactionUrl = `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(postMultisigTransactionUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.postMultisigTransaction({
          address: safeAddress,
          data: proposeTransactionDto,
        }),
      ).rejects.toThrow(expected);

      const { safeTxHash, ...rest } = proposeTransactionDto;
      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postMultisigTransactionUrl,
        data: {
          ...rest,
          contractTransactionHash: safeTxHash,
        },
      });
    });
  });

  describe('postMessage', () => {
    it('should post message', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const message = faker.word.words();
      const safeAppId = faker.number.int();
      const signature = faker.string.hexadecimal();
      const origin = fakeJson();
      const postMessageUrl = `${baseUrl}/api/v1/safes/${safeAddress}/messages/`;
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.postMessage({
        safeAddress,
        message,
        safeAppId,
        signature,
        origin,
      });

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postMessageUrl,
        data: {
          message,
          safeAppId,
          signature,
          origin,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const message = faker.word.words();
      const safeAppId = faker.number.int();
      const signature = faker.string.hexadecimal();
      const origin = fakeJson();
      const postMessageUrl = `${baseUrl}/api/v1/safes/${safeAddress}/messages/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(postMessageUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.postMessage({
          safeAddress,
          message,
          safeAppId,
          signature,
          origin,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postMessageUrl,
        data: {
          message,
          safeAppId,
          signature,
          origin,
        },
      });
    });
  });

  describe('postMessageSignature', () => {
    it('should post message', async () => {
      const messageHash = faker.string.hexadecimal();
      const signature = faker.string.hexadecimal();
      const postMessageSignatureUrl = `${baseUrl}/api/v1/messages/${messageHash}/signatures/`;
      networkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await service.postMessageSignature({
        messageHash,
        signature,
      });

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postMessageSignatureUrl,
        data: {
          signature,
        },
      });
    });

    const errorMessage = faker.word.words();
    it.each([
      ['Transaction Service', { nonFieldErrors: [errorMessage] }],
      ['standard', new Error(errorMessage)],
    ])(`should forward a %s error`, async (_, error) => {
      const messageHash = faker.string.hexadecimal();
      const signature = faker.string.hexadecimal();
      const postMessageSignatureUrl = `${baseUrl}/api/v1/messages/${messageHash}/signatures/`;
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const expected = new DataSourceError(errorMessage, statusCode);
      networkService.post.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(postMessageSignatureUrl),
          {
            status: statusCode,
          } as Response,
          error,
        ),
      );

      await expect(
        service.postMessageSignature({
          messageHash,
          signature,
        }),
      ).rejects.toThrow(expected);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith({
        url: postMessageSignatureUrl,
        data: {
          signature,
        },
      });
    });
  });

  describe('clearMessagesBySafe', () => {
    it('should clear the messages cache by Safe address', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await service.clearMessagesBySafe({ safeAddress });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_messages_${safeAddress}`,
      );
    });
  });

  describe('clearMessagesByHash', () => {
    it('should clear the message cache by messages hash', async () => {
      const messageHash = faker.string.hexadecimal();

      await service.clearMessagesByHash({ messageHash });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_message_${messageHash}`,
      );
    });
  });

  // TODO: Remove temporary cache times test for Holesky chain.
  describe('temp - Holesky expiration times', () => {
    it('should use the Holesky expiration time for the datasource', async () => {
      const holeskyExpirationTime = faker.number.int();
      const holeskyChainId = '17000';
      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        if (key === 'expirationTimeInSeconds.holesky') {
          return holeskyExpirationTime;
        }
        if (key === 'expirationTimeInSeconds.indexing') {
          return indexingExpirationTimeInSeconds;
        }
        if (key === 'expirationTimeInSeconds.default') {
          return defaultExpirationTimeInSeconds;
        }
        if (key === 'expirationTimeInSeconds.notFound.default') {
          return notFoundExpireTimeSeconds;
        }
        if (key === 'expirationTimeInSeconds.notFound.contract') {
          return notFoundExpireTimeSeconds;
        }
        if (key === 'expirationTimeInSeconds.notFound.token') {
          return notFoundExpireTimeSeconds;
        }
        if (key === 'owners.ownersTtlSeconds') {
          return ownersTtlSeconds;
        }
        throw Error(`Unexpected key: ${key}`);
      });

      service = new TransactionApi(
        holeskyChainId, // Holesky chainId
        baseUrl,
        mockDataSource,
        mockCacheService,
        mockConfigurationService,
        httpErrorFactory,
        mockNetworkService,
        mockLoggingService,
      );

      const token = tokenBuilder().build();
      const tokensPage = pageBuilder().with('results', [token]).build();
      const limit = faker.number.int();
      const offset = faker.number.int();
      const getTokensUrl = `${baseUrl}/api/v1/tokens/`;
      const cacheDir = new CacheDir(
        `${holeskyChainId}_tokens`,
        `${limit}_${offset}`,
      );
      mockDataSource.get.mockResolvedValueOnce(rawify(tokensPage));

      const actual = await service.getTokens({
        limit,
        offset,
      });

      expect(actual).toBe(tokensPage);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir,
        expireTimeSeconds: holeskyExpirationTime,
        notFoundExpireTimeSeconds: holeskyExpirationTime,
        url: getTokensUrl,
        networkRequest: {
          params: {
            limit,
            offset,
          },
        },
      });
    });
  });
});
