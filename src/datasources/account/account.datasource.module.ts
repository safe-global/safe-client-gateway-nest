import { Module } from '@nestjs/common';
import { AccountDataSource } from '@/datasources/account/account.datasource';
import { IAccountDataSource } from '@/domain/interfaces/account.datasource.interface';
import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [{ provide: IAccountDataSource, useClass: AccountDataSource }],
  exports: [IAccountDataSource],
})
export class AccountDataSourceModule {}
