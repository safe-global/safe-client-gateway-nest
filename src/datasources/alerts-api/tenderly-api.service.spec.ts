import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { TenderlyApi } from '@/datasources/alerts-api/tenderly-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';

const networkService = {
  post: jest.fn(),
  delete: jest.fn(),
} as unknown as INetworkService;
const mockNetworkService = jest.mocked(networkService);

describe('TenderlyApi', () => {
  let service: TenderlyApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;

  let tenderlyBaseUri: string;
  let tenderlyApiKey: string;
  let tenderlyAccount: string;
  let tenderlyProject: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    tenderlyBaseUri = faker.internet.url({ appendSlash: false });
    tenderlyApiKey = faker.string.hexadecimal({ length: 32 });
    tenderlyAccount = faker.string.sample();
    tenderlyProject = faker.string.sample();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('alerts.baseUri', tenderlyBaseUri);
    fakeConfigurationService.set('alerts.apiKey', tenderlyApiKey);
    fakeConfigurationService.set('alerts.account', tenderlyAccount);
    fakeConfigurationService.set('alerts.project', tenderlyProject);

    httpErrorFactory = new HttpErrorFactory();

    service = new TenderlyApi(
      fakeConfigurationService,
      mockNetworkService,
      httpErrorFactory,
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();
    const httpErrorFactory = new HttpErrorFactory();

    expect(
      () =>
        new TenderlyApi(
          fakeConfigurationService,
          mockNetworkService,
          httpErrorFactory,
        ),
    ).toThrow();
  });

  it('should add contracts', async () => {
    const fakeDisplayName = (): `${string}:${string}:${string}` => {
      const chain = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      const moduleAddress = faker.finance.ethereumAddress();
      return `${chain}:${safeAddress}:${moduleAddress}`;
    };

    const contracts: Array<AlertsRegistration> = [
      {
        address: faker.finance.ethereumAddress(),
        displayName: fakeDisplayName(),
        chainId: faker.string.numeric(),
      },
      {
        address: faker.finance.ethereumAddress(),
        displayName: fakeDisplayName(),
        chainId: faker.string.numeric(),
      },
      {
        address: faker.finance.ethereumAddress(),
        displayName: fakeDisplayName(),
        chainId: faker.string.numeric(),
      },
    ];

    await service.addContracts(contracts);

    expect(mockNetworkService.post).toHaveBeenCalledWith(
      `${tenderlyBaseUri}/api/v2/accounts/${tenderlyAccount}/projects/${tenderlyProject}/contracts`,
      {
        headers: {
          'X-Access-Key': tenderlyApiKey,
        },
        params: {
          contracts: contracts.map((contract) => ({
            address: contract.address,
            display_name: contract.displayName,
            network_id: contract.chainId,
          })),
        },
      },
    );
  });

  it('should forward error', async () => {
    const status = faker.internet.httpStatusCode({ types: ['serverError'] });
    const error = new NetworkResponseError(
      new URL(tenderlyBaseUri),
      {
        status,
      } as Response,
      {
        message: 'Unexpected error',
      },
    );
    mockNetworkService.post.mockRejectedValueOnce(error);

    await expect(service.addContracts([])).rejects.toThrow(
      new DataSourceError('Unexpected error', status),
    );

    expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
  });
});
