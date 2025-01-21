import { Injectable } from '@nestjs/common';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';

@Injectable()
export class UsersRepository implements IUsersRepository {}
