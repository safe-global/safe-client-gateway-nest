import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { Module } from '@nestjs/common';

const emailApi = {
  createMessage: jest.fn(),
  deleteEmailAddress: jest.fn(),
};

@Module({
  providers: [
    HttpErrorFactory,
    {
      provide: IEmailApi,
      useFactory: (): any => jest.mocked(emailApi),
    },
  ],
  exports: [IEmailApi],
})
export class TestEmailApiModule {}
