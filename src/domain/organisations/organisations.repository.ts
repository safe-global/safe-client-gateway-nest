import { Injectable } from '@nestjs/common';
import { IOrganisationsRepository } from '@/domain/organisations/organisations.repository.interface';

@Injectable()
export class OrganisationsRepository implements IOrganisationsRepository {}
