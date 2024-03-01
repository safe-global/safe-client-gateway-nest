import { Module } from '@nestjs/common';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';

const accountDataSource = {
  getVerifiedAccountEmailsBySafeAddress: jest.fn(),
  getAccount: jest.fn(),
  createAccount: jest.fn(),
  setEmailVerificationCode: jest.fn(),
  setEmailVerificationSentDate: jest.fn(),
  verifyEmail: jest.fn(),
  deleteAccount: jest.fn(),
  updateAccountEmail: jest.fn(),
} as jest.MockedObjectDeep<IAccountDataSource>;

@Module({
  providers: [
    {
      provide: IAccountDataSource,
      useFactory: (): any => {
        return jest.mocked(accountDataSource);
      },
    },
  ],
  exports: [IAccountDataSource],
})
export class TestAccountDataSourceModule {}
