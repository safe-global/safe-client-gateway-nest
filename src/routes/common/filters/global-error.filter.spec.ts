import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import * as request from 'supertest';
import { APP_FILTER } from '@nestjs/core';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';

@Controller({})
class TestController {
  @Get('http-exception')
  async httpException(): Promise<void> {
    throw new HttpException(
      { message: 'Some http exception' },
      HttpStatus.BAD_GATEWAY,
    );
  }

  @Get('non-http-exception')
  async nonHttpException(): Promise<void> {
    throw new Error('Some random error');
  }
}

describe('GlobalErrorFilter tests', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalErrorFilter,
        },
      ],
    }).compile();
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('http exception returns correct error code and message', async () => {
    await request(app.getHttpServer())
      .get('/http-exception')
      .expect(502)
      .expect({ message: 'Some http exception' });
  });

  it('non http exception returns correct error code and message', async () => {
    await request(app.getHttpServer())
      .get('/non-http-exception')
      .expect(500)
      .expect({
        code: 500,
        message: 'Internal server error',
      });
  });
});
