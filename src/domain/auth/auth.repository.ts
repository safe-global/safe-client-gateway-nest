import { CacheRouter } from '@/datasources/cache/cache.router';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { IAuthApi } from '@/domain/interfaces/auth-api.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { AuthService } from '@/routes/auth/auth.service';
import { VerifyAuthMessageDto } from '@/routes/auth/entities/schemas/verify-auth-message.dto';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';

@Injectable()
export class AuthRepository implements IAuthRepository {
  private readonly nonceTtlInSeconds: number;

  constructor(
    @Inject(IAuthApi)
    private readonly authApi: IAuthApi,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
  ) {
    this.nonceTtlInSeconds = this.configurationService.getOrThrow(
      'auth.nonceTtlSeconds',
    );
  }

  /**
   * Generates a unique nonce and stores it in cache for later verification.
   *
   * @returns nonce - unique string to be signed
   */
  async generateNonce(): Promise<{ nonce: string }> {
    const nonce = this.authApi.generateNonce();

    // Store nonce for reference to verify/prevent replay attacks
    const cacheDir = CacheRouter.getAuthNonceCacheDir(nonce);
    await this.cacheService.set(cacheDir, nonce, this.nonceTtlInSeconds);

    return {
      nonce,
    };
  }

  /**
   * Verifies the validity of a signed message and returns an access token:
   *
   * 1. Ensure the message itself has not expired.
   * 2. Ensure the nonce was generated by us/is not a replay attack.
   * 3. Verify the signature of the message.
   * 4. Return an access token if all checks pass.
   *
   * @param args - DTO containing the message and signature to verify.
   *
   * The following adhere to JWT standard {@link https://datatracker.ietf.org/doc/html/rfc7519}
   *
   * @returns accessToken - JWT access token
   * @returns tokenType - token type ('Bearer') to be used in the `Authorization` header
   * @returns notBefore - epoch from when token is valid (if applicable, otherwise null)
   * @returns expiresIn - time in seconds until the token expires (if applicable, otherwise null)
   */
  async verify(args: VerifyAuthMessageDto): Promise<{
    accessToken: string;
    tokenType: string;
    notBefore: number | null;
    expiresIn: number | null;
  }> {
    const isValid = await this.isValid(args).catch(() => false);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    const dateWhenTokenIsValid = args.message.notBefore
      ? new Date(args.message.notBefore)
      : null;
    const dateWhenTokenExpires = args.message.expirationTime
      ? new Date(args.message.expirationTime)
      : null;

    const secondsUntilTokenIsValid = dateWhenTokenIsValid
      ? this.getSecondsUntil(dateWhenTokenIsValid)
      : null;
    const secondsUntilTokenExpires = dateWhenTokenExpires
      ? this.getSecondsUntil(dateWhenTokenExpires)
      : null;

    const accessToken = this.jwtService.sign(args.message, {
      ...(secondsUntilTokenIsValid !== null && {
        notBefore: secondsUntilTokenIsValid,
      }),
      ...(secondsUntilTokenExpires !== null && {
        expiresIn: secondsUntilTokenExpires,
      }),
    });

    return {
      tokenType: AuthService.AUTH_TOKEN_TOKEN_TYPE,
      accessToken,
      // Differing measurements match JWT standard {@link https://datatracker.ietf.org/doc/html/rfc7519}
      notBefore: dateWhenTokenIsValid?.getTime() ?? null,
      expiresIn: secondsUntilTokenExpires,
    };
  }

  /**
   * Verifies that a message is valid according to its expiration date,
   * signature and nonce.
   *
   * @param args.message - SiWe message in object form
   * @param args.signature - signature from signing the message
   *
   * @returns boolean - whether the message is valid
   */
  private async isValid(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean> {
    const cacheDir = CacheRouter.getAuthNonceCacheDir(args.message.nonce);

    const isExpired =
      !!args.message.expirationTime &&
      new Date(args.message.expirationTime) < new Date();

    try {
      // Verification is not necessary, message has expired
      if (isExpired) {
        return false;
      }

      const [isValidSignature, cachedNonce] = await Promise.all([
        this.authApi.verifyMessage(args),
        this.cacheService.get(cacheDir),
      ]);
      const isValidNonce = cachedNonce === args.message.nonce;

      return isValidSignature && isValidNonce;
    } catch {
      return false;
    } finally {
      await this.cacheService.deleteByKey(cacheDir.key);
    }
  }

  private getSecondsUntil(date: Date): number {
    return Math.floor((date.getTime() - Date.now()) / 1_000);
  }

  /**
   * Extracts the access token from the request.
   *
   * @param request - the express request object
   * @param tokenType - the type of token used in the Authorization header
   * @returns the access token, or null if not found
   */
  getAccessToken(request: Request, tokenType: string): string | null {
    const header = request.headers.authorization;

    if (!header) {
      return null;
    }

    const [type, token] = header.split(' ');

    if (type !== tokenType || !token) {
      return null;
    }

    return token;
  }
}
