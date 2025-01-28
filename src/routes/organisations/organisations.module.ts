import { Module } from '@nestjs/common';
import { OrganisationsRepositoryModule } from '@/domain/organisations/organisations.repository.module';
import { OrganisationsController } from '@/routes/organisations/organisations.controller';
import { OrganisationsService } from '@/routes/organisations/organisations.service';

@Module({
  imports: [OrganisationsRepositoryModule],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
})
export class OrganisationsModule {}
