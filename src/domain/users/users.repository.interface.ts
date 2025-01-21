import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { User, UserStatus } from '@/domain/users/entities/user.entity';

export const IUsersRepository = Symbol('IUsersRepository');

// TODO: remove lint exception after class is implemented

export interface IUsersRepository {
  // async createUserWithWallet(createUserDto: CreateUserDto): Promise<User> {})

  createUserWithWallet(args: {
    status: UserStatus;
    authPayload: AuthPayload;
  }): Promise<User>;

  //   addWalletToUser(args: {
  //     authPayload: AuthPayload;
  //     walletAddress: `0x${string}`;
  //     userId: number;
  //   }): Promise<void>;

  //   getUserByWalletAddress(args: {
  //     authPayload: AuthPayload;
  //     walletAddress: `0x${string}`;
  //   }): Promise<User>;
}
