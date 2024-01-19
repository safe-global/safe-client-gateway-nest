import { Test, TestingModule } from '@nestjs/testing';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { ClsModule } from 'nestjs-cls';
import { ConfigurationModule } from '@/config/configuration.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { NetworkModule } from '@/datasources/network/network.module';
import { FETCH_CLIENT } from '@/datasources/network/fetch.client';

describe('NetworkModule', () => {
  it(`fetch client is created with timeout and is kept alive`, async () => {
    const fetchMock = jest.fn();
    jest.spyOn(global, 'fetch').mockImplementationOnce(fetchMock);

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
    const app = moduleFixture.createNestApplication();
    const fetchClient = moduleFixture.get(FETCH_CLIENT);
    const configurationService = moduleFixture.get(IConfigurationService);
    const httpClientTimeout = configurationService.get(
      'httpClient.requestTimeout',
    );
    await app.init();

    try {
      await fetchClient('', {
        method: 'GET',
      });
    } catch {
      // fetch response is not mocked but we are only concerned with RequestInit options
    }

    expect(fetchMock).toHaveBeenCalledWith('', {
      method: 'GET',
      signal: AbortSignal.timeout(httpClientTimeout), // timeout is set
      keepalive: true,
    });

    await app.close();
  });
});
