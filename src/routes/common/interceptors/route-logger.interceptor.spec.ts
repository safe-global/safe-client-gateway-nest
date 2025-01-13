import { ILoggingService } from '@/logging/logging.interface';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  INestApplication,
  Query,
} from '@nestjs/common';
import request from 'supertest';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { faker } from '@faker-js/faker';
import { RouteLoggerInterceptor } from '@/routes/common/interceptors/route-logger.interceptor';
import { Server } from 'net';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ZodError } from 'zod';

// We expect 500 instead of the status code of the DataSourceError
// The reason is that this test webserver does not have logic to map
// DataSourceErrors to HTTP responses (it is not the goal of this test)
// The goal of the test is to test that we are logging correctly
// (see expects below)
const expectedDatasourceErrorCode = 500;

const mockLoggingService: jest.MockedObjectDeep<ILoggingService> = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

class ErrorWithCode extends Error {
  private readonly code: number;

  public constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

@Controller({ path: 'test' })
class TestController {
  @Get('server-error')
  getServerError(): void {
    throw new HttpException('Some 500 error', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Get('server-data-source-error')
  getServerDataSourceError(): void {
    throw new DataSourceError(
      'Some DataSource error',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  @Get('validation-error')
  validationError(
    @Query('numeric_string', new ValidationPipe(NumericStringSchema))
    _: `0x${string}`,
  ): void {}
  /* eslint-enable @typescript-eslint/no-unused-vars */

  @Get('zod-error')
  zodError(): never {
    throw new ZodError([]);
  }

  @Get('error-level-info-with-code')
  errorLevelInfoWithCode(): void {
    throw new ErrorWithCode('error', 430);
  }

  @Get('error-level-error-with-code')
  errorLevelErrorWithCode(): void {
    throw new ErrorWithCode('error', 530);
  }

  @Get('server-error-non-http')
  getNonHttpError(): void {
    throw new Error('Some random error');
  }

  @Get('client-error')
  getClientError(): void {
    throw new HttpException('Some 400 error', HttpStatus.METHOD_NOT_ALLOWED);
  }

  @Get('success')
  getSuccess(): void {
    return;
  }

  @Get('success/:chainId')
  getSuccessWithChainId(): void {
    return;
  }
}

describe('RouteLoggerInterceptor tests', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new RouteLoggerInterceptor(mockLoggingService));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('500 error triggers error level', async () => {
    await request(app.getHttpServer()).get('/test/server-error').expect(500);

    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: 'Some 500 error',
      method: 'GET',
      path: '/test/server-error',
      response_time_ms: expect.any(Number),
      route: '/test/server-error',
      safe_app_user_agent: null,
      status_code: 500,
      origin: null,
    });
    expect(mockLoggingService.info).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('500 Datasource error triggers error level', async () => {
    await request(app.getHttpServer())
      .get('/test/server-data-source-error')
      .expect(500);

    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: 'Some DataSource error',
      method: 'GET',
      path: '/test/server-data-source-error',
      response_time_ms: expect.any(Number),
      route: '/test/server-data-source-error',
      safe_app_user_agent: null,
      status_code: 501,
      origin: null,
    });
    expect(mockLoggingService.info).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('500 Any error triggers error level', async () => {
    await request(app.getHttpServer())
      .get('/test/error-level-error-with-code')
      .expect(expectedDatasourceErrorCode);

    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: 'error',
      method: 'GET',
      path: '/test/error-level-error-with-code',
      response_time_ms: expect.any(Number),
      route: '/test/error-level-error-with-code',
      safe_app_user_agent: null,
      status_code: 530,
      origin: null,
    });
    expect(mockLoggingService.info).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('400 error triggers info level', async () => {
    await request(app.getHttpServer()).get('/test/client-error').expect(405);

    expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: 'Some 400 error',
      method: 'GET',
      path: '/test/client-error',
      response_time_ms: expect.any(Number),
      route: '/test/client-error',
      safe_app_user_agent: null,
      status_code: 405,
      origin: null,
    });
    expect(mockLoggingService.error).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('400 Validation error triggers info level', async () => {
    await request(app.getHttpServer())
      .get('/test/validation-error')
      .expect(expectedDatasourceErrorCode);

    expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: expect.stringMatching(
        JSON.stringify([
          {
            code: expect.any(String),
            expected: expect.any(String),
            received: expect.any(String),
            path: expect.any(Array),
            message: expect.any(String),
          },
        ]),
      ),
      method: 'GET',
      path: '/test/validation-error',
      response_time_ms: expect.any(Number),
      route: '/test/validation-error',
      safe_app_user_agent: null,
      status_code: 422,
      origin: null,
    });
    expect(mockLoggingService.error).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('400 Zod error triggers info level', async () => {
    await request(app.getHttpServer())
      .get('/test/zod-error')
      .expect(expectedDatasourceErrorCode);

    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: '[]',
      method: 'GET',
      path: '/test/zod-error',
      response_time_ms: expect.any(Number),
      route: '/test/zod-error',
      safe_app_user_agent: null,
      status_code: 502,
      origin: null,
    });
    expect(mockLoggingService.info).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('400 Any error triggers info level', async () => {
    await request(app.getHttpServer())
      .get('/test/error-level-info-with-code')
      .expect(expectedDatasourceErrorCode);

    expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: 'error',
      method: 'GET',
      path: '/test/error-level-info-with-code',
      response_time_ms: expect.any(Number),
      route: '/test/error-level-info-with-code',
      safe_app_user_agent: null,
      status_code: 430,
      origin: null,
    });
    expect(mockLoggingService.error).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('200 triggers info level', async () => {
    await request(app.getHttpServer()).get('/test/success').expect(200);

    expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: null,
      method: 'GET',
      path: '/test/success',
      response_time_ms: expect.any(Number),
      route: '/test/success',
      safe_app_user_agent: null,
      status_code: 200,
      origin: null,
    });
    expect(mockLoggingService.error).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('200 with chainId logs chain id', async () => {
    const chainId = faker.string.numeric();
    await request(app.getHttpServer())
      .get(`/test/success/${chainId}`)
      .expect(200);

    expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.info).toHaveBeenCalledWith({
      chain_id: chainId,
      client_ip: null,
      detail: null,
      method: 'GET',
      path: `/test/success/${chainId}`,
      response_time_ms: expect.any(Number),
      route: '/test/success/:chainId',
      safe_app_user_agent: null,
      status_code: 200,
      origin: null,
    });
    expect(mockLoggingService.error).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('non http error triggers error level', async () => {
    await request(app.getHttpServer())
      .get('/test/server-error-non-http')
      .expect(500);

    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: 'Some random error',
      method: 'GET',
      path: '/test/server-error-non-http',
      response_time_ms: expect.any(Number),
      route: '/test/server-error-non-http',
      safe_app_user_agent: null,
      status_code: 500,
      origin: null,
    });
    expect(mockLoggingService.info).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('Logs Safe-App-User-Agent header', async () => {
    const safeAppUserAgentHeader = faker.word.sample();

    await request(app.getHttpServer())
      .get('/test/success')
      .set('Safe-App-User-Agent', safeAppUserAgentHeader)
      .expect(200);

    expect(mockLoggingService.info).toHaveBeenCalledWith({
      chain_id: null,
      client_ip: null,
      detail: null,
      method: 'GET',
      path: '/test/success',
      response_time_ms: expect.any(Number),
      route: '/test/success',
      safe_app_user_agent: safeAppUserAgentHeader,
      status_code: 200,
      origin: null,
    });
  });
});
