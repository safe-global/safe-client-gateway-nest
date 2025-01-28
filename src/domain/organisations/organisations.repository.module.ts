import { Module } from '@nestjs/common';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organisations } from '@/datasources/organisations/entities/organisations.entity.db';
import { IOrganisationsRepository } from '@/domain/organisations/organisations.repository.interface';
import { OrganisationsRepository } from '@/domain/organisations/organisations.repository';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Organisations]),
  ],
  providers: [
    {
      provide: IOrganisationsRepository,
      useClass: OrganisationsRepository,
    },
  ],
  exports: [IOrganisationsRepository],
})
export class OrganisationsRepositoryModule {}
