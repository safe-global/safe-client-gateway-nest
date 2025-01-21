import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '@/routes/users/users.service';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Request } from 'express';
import { User } from '@/routes/users/entities/user.entity';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOkResponse({ type: User })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  async createUser(
    @Auth() authPayload: AuthPayload,
    @Req() req: Request,
  ): Promise<User> {
    return this.usersService.createUser({
      authPayload,
      clientIp: req.ip,
    });
  }
}
