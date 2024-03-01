import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { PaginationData } from '@/routes/common/pagination/pagination.data';

describe('PaginationDataDecorator', () => {
  let app: INestApplication;
  let paginationData: PaginationData;

  @Controller()
  class TestController {
    @Get()
    route(@PaginationDataDecorator() data: PaginationData): void {
      paginationData = data;
      return;
    }
  }

  @Module({ controllers: [TestController] })
  class TestModule {}

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('no cursor', async () => {
    await request(app.getHttpServer())
      .get('')
      .query('some_param=test')
      .expect(200);

    expect(paginationData.limit).toBe(PaginationData.DEFAULT_LIMIT);
    expect(paginationData.offset).toBe(PaginationData.DEFAULT_OFFSET);
  });

  it('with cursor', async () => {
    await request(app.getHttpServer())
      .get('')
      .query('cursor=limit%3D1%26offset%3D0')
      .expect(200);

    expect(paginationData.limit).toBe(1);
    expect(paginationData.offset).toBe(0);
  });
});
