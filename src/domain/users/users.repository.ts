import { Injectable } from '@nestjs/common';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import {
  User as DomainUser,
  UserStatus,
} from '@/domain/users/entities/user.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/users/entities/wallets.entity.db';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<DomainUser> {
    // The transaction method ensures that if anything inside throws
    // an exception, all changes will be rolled back.
    return this.postgresDatabaseService.transaction(async (manager) => {
      // 1) Get Repositories from the Transaction Manager
      const userRepository = manager.getRepository(User);
      const walletRepository = manager.getRepository(Wallet);

      // 2) Create (but do not yet save) the User entity
      const user = userRepository.create({
        status: args.status,
      });

      // 3) Save the User
      const createdUser = await userRepository.save(user);

      // 4) Create the Wallet entity
      const wallet = walletRepository.create({
        user: createdUser, // establishing the relationship
      });

      // 5) Save the Wallet
      await walletRepository.save(wallet);

      // 6) Return the created user (optionally join with wallets if you want)
      return createdUser;
    });
  }
}
