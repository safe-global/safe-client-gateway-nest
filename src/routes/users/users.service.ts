import { Inject } from '@nestjs/common';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Request } from 'express';
import { User } from '@/routes/users/entities/user.entity';
import {
  UserStatus,
  User as DomainUser,
} from '@/domain/users/entities/user.entity';

export class UsersService {
  constructor(
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
  ) {}

  async createUser(args: {
    authPayload: AuthPayload;
    clientIp: Request['ip'];
  }): Promise<User> {
    const domainUser = await this.usersRepository.createUserWithWallet({
      authPayload: args.authPayload,
      status: UserStatus.ACTIVE,
    });

    return this.mapAccount(domainUser);
  }

  private mapAccount(domainUser: DomainUser): User {
    return new User(domainUser.id.toString());
  }
}
