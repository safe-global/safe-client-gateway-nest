import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { AuthController } from '@/routes/auth/auth.controller';
import { AuthPayload } from '@/routes/auth/entities/auth-payload.entity';
import { Request } from 'express';

declare module 'express' {
  // Inject AuthPayload to express.Request
  interface Request {
    auth?: AuthPayload | undefined;
  }
}

/**
 * The AuthGuard should be used to protect routes that require authentication.
 *
 * It checks for the presence of a valid JWT access token in the request and
 * verifies its validity before adding the parsed payload back to the request
 * and allowing access to the route.
 *
 * 1. Check for the presence of an access token in the request.
 * 2. Verify the token's validity.
 * 3. If valid, allow access.
 */

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(IAuthRepository) private readonly authRepository: IAuthRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();

    const accessToken =
      request.cookies[AuthController.ACCESS_TOKEN_COOKIE_NAME];

    // No token in the request
    if (!accessToken) {
      return false;
    }

    try {
      request.auth = this.authRepository.verifyToken(accessToken);
      return true;
    } catch {
      return false;
    }
  }
}
