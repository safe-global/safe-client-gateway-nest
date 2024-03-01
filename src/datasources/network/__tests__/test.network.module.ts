import { Global, Module } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';

const networkService: INetworkService = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

/**
 * The {@link TestNetworkModule} should be used whenever a mocked HTTP client
 * should be used.
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestNetworkModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real HTTP client with a mocked one
 */
@Global()
@Module({
  providers: [
    {
      provide: NetworkService,
      useFactory: (): any => {
        return jest.mocked(networkService);
      },
    },
  ],
  exports: [NetworkService],
})
export class TestNetworkModule {}
