import request from 'supertest';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { addRecoveryModuleDtoBuilder } from '@/routes/recovery/entities/__tests__/add-recovery-module.dto.builder';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  AlertsApiConfigurationModule,
  ALERTS_API_CONFIGURATION_MODULE,
} from '@/datasources/alerts-api/configuration/alerts-api.configuration.module';
import alertsApiConfiguration from '@/datasources/alerts-api/configuration/__tests__/alerts-api.configuration';
import {
  AlertsConfigurationModule,
  ALERTS_CONFIGURATION_MODULE,
} from '@/routes/alerts/configuration/alerts.configuration.module';
import alertsConfiguration from '@/routes/alerts/configuration/__tests__/alerts.configuration';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { RecoveryController } from '@/routes/recovery/recovery.controller';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';

describe('Recovery (Unit)', () => {
  let app: INestApplication<Server>;
  let alertsUrl: string;
  let alertsAccount: string;
  let alertsProject: string;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let jwtService: IJwtService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        email: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(ALERTS_CONFIGURATION_MODULE)
      .useModule(AlertsConfigurationModule.register(alertsConfiguration))
      .overrideModule(ALERTS_API_CONFIGURATION_MODULE)
      .useModule(AlertsApiConfigurationModule.register(alertsApiConfiguration))
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    alertsUrl = configurationService.getOrThrow('alerts-api.baseUri');
    alertsAccount = configurationService.getOrThrow('alerts-api.account');
    alertsProject = configurationService.getOrThrow('alerts-api.project');
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    jwtService = moduleFixture.get<IJwtService>(IJwtService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('AuthGuard', () => {
    it('checks that the AuthGuard is applied to the proper controller endpoints', () => {
      const protectedEndpoints = [
        RecoveryController.prototype.addRecoveryModule,
        RecoveryController.prototype.deleteRecoveryModule,
      ];
      protectedEndpoints.forEach((fn) => checkGuardIsApplied(AuthGuard, fn));
    });
  });

  describe('POST add recovery module for a Safe', () => {
    it('Success', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify({ safes: [safe.address] }),
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.resolve({ status: 200, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(addRecoveryModuleDto)
        .expect(200);
    });

    it('should return 401 if chain_id does not match that of the request', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', faker.string.numeric({ exclude: [chain.chainId] }))
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(addRecoveryModuleDto)
        .expect(401);

      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('should return 401 if token is not from that of a Safe owner', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(addRecoveryModuleDto)
        .expect(401);

      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('should return 401 if module is not enabled on the Safe', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/modules/${addRecoveryModuleDto.moduleAddress}/safes/`
        ) {
          return Promise.resolve({
            status: 200,
            data: rawify({ safes: [] }),
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.resolve({ status: 200, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(addRecoveryModuleDto)
        .expect(401);

      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('should get a validation error', async () => {
      const addRecoveryModuleDto = {
        moduleAddress: faker.number.int(), // Invalid address
      };
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(addRecoveryModuleDto)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['moduleAddress'],
          message: 'Expected string, received number',
        });

      expect(networkService.get).not.toHaveBeenCalled();
      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('Should return the alerts provider error message', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`,
        ),
        {
          status: 400,
        } as Response,
        {
          message: 'Malformed body',
          status: 400,
        },
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send(addRecoveryModuleDto);
    });

    it('Should fail with An error occurred', async () => {
      const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const chain = chainBuilder().build();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const timestamp = jest.now();
      const message = `enable-recovery-alerts-${chain.chainId}-${safe.address}-${addRecoveryModuleDto.moduleAddress}-${signer.address}-${timestamp}`;
      const signature = await signer.signMessage({ message });
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`,
        ),
        {
          status: statusCode,
        } as Response,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/address`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/safes/${safe.address}/recovery`)
        .set('Safe-Wallet-Signature', signature)
        .set('Safe-Wallet-Signature-Timestamp', timestamp.toString())
        .send(addRecoveryModuleDto);
    });
  });

  describe('DELETE remove recovery module for a Safe', () => {
    it('Success', async () => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.resolve({ status: 204, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(204);
    });

    it('should return 401 if chain_id does not match that of the request', async () => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', faker.string.numeric({ exclude: [chain.chainId] }))
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(networkService.delete).not.toHaveBeenCalled();
    });

    it('should return 401 if token is not from that of a Safe owner', async () => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      expect(() => jwtService.verify(accessToken)).not.toThrow();
      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(401);

      expect(networkService.delete).not.toHaveBeenCalled();
    });

    it('Should return the alerts provider error message', async () => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`,
        ),
        {
          status: 400,
        } as Response,
        {
          message: 'Malformed body',
          status: 400,
        },
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const moduleAddress = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const signerAddress = safe.owners[0];
      const authPayloadDto = authPayloadDtoBuilder()
        .with('chain_id', chain.chainId)
        .with('signer_address', signerAddress)
        .build();
      const accessToken = jwtService.sign(authPayloadDto);
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });
      const error = new NetworkResponseError(
        new URL(
          `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`,
        ),
        {
          status: statusCode,
        } as Response,
      );

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ status: 200, data: rawify(chain) });
        }
        if (
          url === `${chain.transactionService}/api/v1/safes/${safe.address}`
        ) {
          return Promise.resolve({ status: 200, data: rawify(safe) });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${alertsUrl}/api/v1/account/${alertsAccount}/project/${alertsProject}/contract/${chain.chainId}/${moduleAddress}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/recovery/${moduleAddress}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(statusCode);
    });
  });
});
