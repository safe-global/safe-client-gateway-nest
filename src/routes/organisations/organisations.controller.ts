import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';

@ApiTags('organisations')
@Controller({ path: 'organisations', version: '1' })
export class OrganisationsController {}
