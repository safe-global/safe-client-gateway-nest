import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {}
