import { Test, TestingModule } from '@nestjs/testing';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { ClsModule } from 'nestjs-cls';
import { ConfigurationModule } from '@/config/configuration.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import {
  FetchClient,
  NetworkModule,
} from '@/datasources/network/network.module';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import { fakeJson } from '@/__tests__/faker';

describe('NetworkModule', () => {
  let app: INestApplication;
  let fetchClient: FetchClient;
  let httpClientTimeout: number;

  // fetch response is not mocked but we are only concerned with RequestInit options
  const fetchMock = jest.fn();
  jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NetworkModule,
        // The following imports are required by the Network Module
        // and should be provided in the production app for it to work
        ClsModule.forRoot({ global: true }),
        RequestScopedLoggingModule,
        ConfigurationModule.register(configuration),
      ],
    }).compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    fetchClient = moduleFixture.get('FetchClient');
    httpClientTimeout = configurationService.get('httpClient.requestTimeout');

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`fetch client is created with timeout and is kept alive`, async () => {
    const url = faker.internet.url({ appendSlash: false });

    await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, {
      method: 'GET',
      signal: AbortSignal.timeout(httpClientTimeout), // timeout is set
      keepalive: true,
    });
  });

  it('throws NetworkRequestError when URL is malformed', async () => {
    // Malformed URL will throw so we need not mock fetch
    await expect(
      fetchClient('malformedUrl', { method: 'GET' }),
    ).rejects.toThrow(new NetworkRequestError(null, expect.any(Error)));

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('throws NetworkRequestError when fetch fails', async () => {
    const error = new Error('Fetch failed');
    fetchMock.mockRejectedValue(error);

    const url = faker.internet.url({ appendSlash: false });

    await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow(
      new NetworkRequestError(new URL(url), error),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws NetworkResponseError when response is not OK', async () => {
    const json = fakeJson();
    const response = {
      ok: false,
      json: () => Promise.resolve(json),
    } as Response;
    fetchMock.mockResolvedValue(response);

    const url = faker.internet.url({ appendSlash: false });

    await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow(
      new NetworkResponseError(new URL(url), response, json),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
