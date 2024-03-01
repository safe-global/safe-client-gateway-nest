import { Test, TestingModule } from '@nestjs/testing';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/configuration';
import {
  Controller,
  HttpCode,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TimestampGuard } from '@/routes/email/guards/timestamp.guard';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';

const MAX_ELAPSED_TIME_MS = 5_000;

@Controller()
class TestController {
  @Post('test')
  @HttpCode(200)
  @UseGuards(TimestampGuard(MAX_ELAPSED_TIME_MS))
  async validRoute(): Promise<void> {}
}

describe('TimestampGuard tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.useFakeTimers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
    }).compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('returns 403 on empty body', async () => {
    await request(app.getHttpServer()).post(`/test`).expect(403).expect({
      message: 'Forbidden resource',
      error: 'Forbidden',
      statusCode: 403,
    });
  });

  it('returns 403 if timestamp is not a number', async () => {
    await request(app.getHttpServer())
      .post(`/test`)
      .send({
        timestamp: faker.word.sample(),
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });

  it('returns 200 with 1ms to go', async () => {
    const timestamp = jest.now();
    jest.advanceTimersByTime(MAX_ELAPSED_TIME_MS - 1);

    await request(app.getHttpServer())
      .post(`/test`)
      .send({
        timestamp: timestamp,
      })
      .expect(200);
  });

  it('returns 403 with 0ms to go', async () => {
    const timestamp = jest.now();
    jest.advanceTimersByTime(MAX_ELAPSED_TIME_MS);

    await request(app.getHttpServer())
      .post(`/test`)
      .send({
        timestamp: timestamp,
      })
      .expect(403)
      .expect({
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      });
  });
});
