import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { OctavApi } from '@/datasources/portfolio-api/octav-api.service';
import { rawify } from '@/validation/entities/raw.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { OctavGetPortfolio } from '@/datasources/portfolio-api/entities/octav-get-portfolio.entity';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

describe('OctavApiService', () => {
  let target: OctavApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;
  let baseUri: string;
  let apiKey: string;

  beforeEach(() => {
    jest.resetAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    httpErrorFactory = new HttpErrorFactory();
    baseUri = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.sample();
    fakeConfigurationService.set('portfolio.baseUri', baseUri);
    fakeConfigurationService.set('portfolio.apiKey', apiKey);

    target = new OctavApi(
      fakeConfigurationService,
      mockNetworkService,
      httpErrorFactory,
    );
  });

  it('should error if baseUri is not defined', () => {
    const httpErrorFactory = new HttpErrorFactory();
    const _fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('portfolio.apiKey', apiKey);

    expect(
      () =>
        new OctavApi(
          _fakeConfigurationService,
          mockNetworkService,
          httpErrorFactory,
        ),
    ).toThrow();
  });

  it('should error if apiKey is not defined', () => {
    const httpErrorFactory = new HttpErrorFactory();
    const _fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('portfolio.baseUri', baseUri);

    expect(
      () =>
        new OctavApi(
          _fakeConfigurationService,
          mockNetworkService,
          httpErrorFactory,
        ),
    ).toThrow();
  });

  describe('getPortfolio', () => {
    it('should get portfolio', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const getPortfolio: OctavGetPortfolio = {
        getPortfolio: [portfolioBuilder().build()],
      };
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(getPortfolio),
      });

      await target.getPortfolio(safeAddress);

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/rest/portfolio`,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          params: {
            addresses: safeAddress,
            includeImages: true,
          },
        },
      });
    });

    it('should forward error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/rest/portfolio`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.getPortfolio(safeAddress)).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );
    });
  });
});
