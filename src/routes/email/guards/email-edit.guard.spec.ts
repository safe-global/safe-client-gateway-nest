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
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Hash } from 'viem';
import { EmailEditGuard } from '@/routes/email/guards/email-edit.guard';

@Controller()
class TestController {
  @Post('test/:chainId/:safeAddress')
  @HttpCode(200)
  @UseGuards(EmailEditGuard)
  async validRoute(): Promise<void> {}

  @Post('test/invalid/chains/:chainId')
  @HttpCode(200)
  @UseGuards(EmailEditGuard)
  async invalidRouteWithChainId(): Promise<void> {}

  @Post('test/invalid/safes/:safeAddress')
  @HttpCode(200)
  @UseGuards(EmailEditGuard)
  async invalidRouteWithSafeAddress(): Promise<void> {}
}

describe('EmailEdit guard tests', () => {
  let app: INestApplication;

  const chainId = faker.string.numeric();
  const safe = faker.finance.ethereumAddress();
  const emailAddress = faker.internet.email();
  const timestamp = faker.date.recent().getTime();
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const accountAddress = account.address;
  let signature: Hash;

  beforeAll(async () => {
    const message = `email-edit-${chainId}-${safe}-${emailAddress}-${accountAddress}-${timestamp}`;
    signature = await account.signMessage({ message });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
    }).compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 403 on empty body', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 200 on a valid signature', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        emailAddress,
        account: accountAddress,
        signature,
        timestamp,
      })
      .expect(200);
  });

  it('returns 403 on an invalid signature', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        emailAddress: faker.internet.email(), // different email should have different signature
        account: accountAddress,
        signature,
        timestamp,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the email address is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        account: accountAddress,
        signature,
        timestamp,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the account is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        emailAddress,
        signature,
        timestamp,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the signature is missing from payload', async () => {
    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safe}`)
      .send({
        emailAddress,
        account: accountAddress,
        timestamp,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 403 if the timestamp is missing from payload', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();

    await request(app.getHttpServer())
      .post(`/test/${chainId}/${safeAddress}`)
      .send({
        emailAddress,
        account: accountAddress,
        signature,
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

    await request(app.getHttpServer())
      .post(`/test/invalid/chains/${chainId}`)
      .send({
        emailAddress,
        account: accountAddress,
        signature,
        timestamp,
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

    await request(app.getHttpServer())
      .post(`/test/invalid/safes/${safeAddress}`)
      .send({
        emailAddress,
        account: accountAddress,
        signature,
        timestamp,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
