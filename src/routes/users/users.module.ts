import { Module } from '@nestjs/common';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { UsersController } from '@/routes/users/users.controller';
import { UsersService } from '@/routes/users/users.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';

@Module({
  imports: [UserRepositoryModule, AuthRepositoryModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
