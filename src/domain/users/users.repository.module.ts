import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';

@Module({
  imports: [PostgresDatabaseModuleV2, TypeOrmModule.forFeature([User])],
})
export class UserRepositoryModule {}
