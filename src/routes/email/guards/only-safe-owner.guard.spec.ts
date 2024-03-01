import {
  Controller,
  HttpCode,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';
import { OnlySafeOwnerGuard } from '@/routes/email/guards/only-safe-owner.guard';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

const safeRepository = {
  isOwner: jest.fn(),
} as unknown as ISafeRepository;

const safeRepositoryMock = jest.mocked(safeRepository);

@Controller()
class TestController {
  @Post('test/:chainId/:safeAddress')
  @HttpCode(200)
  @UseGuards(OnlySafeOwnerGuard)
  async validRoute(): Promise<void> {}

  @Post('test/invalid/chains/:chainId')
  @HttpCode(200)
  @UseGuards(OnlySafeOwnerGuard)
  async invalidRouteWithChainId(): Promise<void> {}

  @Post('test/invalid/safes/:safeAddress')
  @HttpCode(200)
  @UseGuards(OnlySafeOwnerGuard)
  async invalidRouteWithSafeAddress(): Promise<void> {}
}

describe('OnlySafeOwner guard tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
      providers: [
        {
          provide: ISafeRepository,
          useValue: safeRepositoryMock,
        },
      ],
    }).compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 403 on empty body', async () => {
    const chainId = faker.string.numeric();
    const safe = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 200 if account is an owner of the safe', async () => {
    const chainId = faker.string.numeric();
    const safe = faker.finance.ethereumAddress();
    const account = faker.finance.ethereumAddress();
    safeRepositoryMock.isOwner.mockImplementation((args) => {
      if (
        args.chainId !== chainId ||
        args.address !== account ||
        args.safeAddress !== safe
      )
        return Promise.reject();
      else return Promise.resolve(true);
    });

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        account: account,
      })
      .expect(200);
  });

  it('returns 403 if account is not an owner of the safe', async () => {
    const chainId = faker.string.numeric();
    const safe = faker.finance.ethereumAddress();
    const account = faker.finance.ethereumAddress();
    safeRepositoryMock.isOwner.mockImplementation((args) => {
      if (
        args.chainId !== chainId ||
        args.address !== account ||
        args.safeAddress !== safe
      )
        return Promise.reject();
      else return Promise.resolve(false);
    });

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        account: account,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without safe address', async () => {
    const chainId = faker.string.numeric();
    const account = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/invalid/chains/${chainId}`)
      .send({
        account: account,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 on routes without chain id', async () => {
    const safeAddress = faker.finance.ethereumAddress();
    const account = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/invalid/safes/${safeAddress}`)
      .send({
        account: account,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
