import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { NotificationsService } from '@/routes/notifications/v1/notifications.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { UpsertSubscriptionsSafesDto } from '@/routes/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification.entity';
import type { UUID } from 'crypto';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import { keccak256, recoverMessageAddress, toBytes } from 'viem';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';

@ApiTags('notifications')
@Controller({ path: '', version: '1' })
export class NotificationsController {
  private static REGISTRATION_TIMESTAMP_EXPIRY = 5 * 60;
  private isPushNotificationV2Enabled: boolean;
  constructor(
    // Adding NotificationServiceV2 to ensure compatibility with V1.
    // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
    @Inject(NotificationsServiceV2)
    private readonly notificationServiceV2: NotificationsServiceV2,
    private readonly notificationsService: NotificationsService,

    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,

    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.isPushNotificationV2Enabled =
      this.configurationService.getOrThrow<boolean>(
        'features.pushNotifications',
      );
  }

  @ApiOkResponse()
  @Post('register/notifications')
  @HttpCode(200)
  async registerDevice(
    @Body() registerDeviceDto: RegisterDeviceDto,
  ): Promise<void> {
    if (!this.isPushNotificationV2Enabled) {
      return await this.notificationsService.registerDevice(registerDeviceDto);
    }

    if (registerDeviceDto.timestamp) {
      this.validateTimestamp(parseInt(registerDeviceDto.timestamp));
    }

    // Compatibility with V2
    const compatibleV2Requests =
      await this.createV2RegisterDto(registerDeviceDto);

    const v2Requests = [];

    for (const compatibleV2Request of compatibleV2Requests) {
      v2Requests.push(
        await this.notificationServiceV2.upsertSubscriptions(
          compatibleV2Request,
        ),
      );
    }
    await Promise.all(v2Requests);

    // Remove tokens from the old service to prevent duplication.
    if (registerDeviceDto.uuid) {
      const unregistrationRequests = [];
      for (const safeRegistration of registerDeviceDto.safeRegistrations) {
        unregistrationRequests.push(
          this.notificationsService.unregisterDevice({
            chainId: safeRegistration.chainId,
            uuid: registerDeviceDto.uuid,
          }),
        );
      }

      await Promise.allSettled(unregistrationRequests).then(
        (results: Array<PromiseSettledResult<unknown>>) => {
          for (const result of results) {
            // If the device is not already registered, the TX service will throw a 404 error, but we can safely ignore it.
            if (
              result.status === 'rejected' &&
              'code' in result.reason &&
              result.reason.code !== 404
            ) {
              this.loggingService.error(result.reason);
            }
          }
        },
      );
    }
  }

  private async createV2RegisterDto(
    args: RegisterDeviceDto,
  ): Promise<
    Array<Parameters<NotificationsServiceV2['upsertSubscriptions']>[0]>
  > {
    const safeV2Array: Array<
      Parameters<NotificationsServiceV2['upsertSubscriptions']>[0] & {
        upsertSubscriptionsDto: {
          safes: Array<UpsertSubscriptionsSafesDto>;
          signature: `0x${string}`;
        };
      }
    > = [];

    const safesV1Registrations = args.safeRegistrations;

    for (const safeV1Registration of safesV1Registrations) {
      if (safeV1Registration.safes.length) {
        const safeV2: Parameters<
          NotificationsServiceV2['upsertSubscriptions']
        >[0] & {
          upsertSubscriptionsDto: {
            safes: Array<UpsertSubscriptionsSafesDto>;
            signature: `0x${string}`;
          };
        } = {
          upsertSubscriptionsDto: {
            cloudMessagingToken: args.cloudMessagingToken,
            deviceType: args.deviceType,
            deviceUuid: (args.uuid as UUID) || undefined,
            safes: [],
            signature: safeV1Registration.signatures[0] as `0x${string}`,
          },
          authPayload: new AuthPayload(),
        };
        const uniqueSafeAddresses = new Set(safeV1Registration.safes);
        for (const safeAddresses of uniqueSafeAddresses) {
          safeV2.upsertSubscriptionsDto.safes.push({
            address: safeAddresses as `0x${string}`,
            chainId: safeV1Registration.chainId,
            notificationTypes: Object.values(NotificationType),
          });
        }
        safeV2Array.push(safeV2);
      }
    }

    for (const [index, safeV2] of safeV2Array.entries()) {
      const safeAddresses = args.safeRegistrations.flatMap(
        (safe) => safe.safes,
      );

      const recoveredAddress = await recoverMessageAddress({
        message: {
          raw: keccak256(
            toBytes(
              `gnosis-safe${args.timestamp}${args.uuid}${args.cloudMessagingToken}${safeAddresses.sort().join('')}`,
            ),
          ),
        },
        signature: safeV2.upsertSubscriptionsDto.signature,
      });

      safeV2.authPayload.chain_id =
        safeV2.upsertSubscriptionsDto.safes[0].chainId;
      safeV2.authPayload.signer_address = recoveredAddress;

      safeV2Array[index].authPayload = safeV2.authPayload;
    }

    return safeV2Array;
  }

  private validateTimestamp(timestamp: number): void {
    const now = new Date().getTime();
    const expires = Math.floor(
      (now + NotificationsController.REGISTRATION_TIMESTAMP_EXPIRY) / 1000,
    );

    if (
      Math.abs(expires - timestamp) >
      NotificationsController.REGISTRATION_TIMESTAMP_EXPIRY
    ) {
      throw new BadRequestException('The signature is expired!');
    }
  }

  @Delete('chains/:chainId/notifications/devices/:uuid')
  async unregisterDevice(
    @Param('chainId') chainId: string,
    @Param('uuid', new ValidationPipe(UuidSchema)) uuid: UUID,
  ): Promise<void> {
    if (this.isPushNotificationV2Enabled) {
      return await this.unregisterDeviceV2Compatible(chainId, uuid);
    }

    await this.notificationsService.unregisterDevice({ chainId, uuid });
  }

  private async unregisterDeviceV2Compatible(
    chainId: string,
    uuid: UUID,
  ): Promise<void> {
    try {
      await this.notificationServiceV2.deleteDevice(uuid);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        // Do not throw a NotFound error when attempting to remove the token from the CGW,
        // This ensures the TX service remove method is called
      } else {
        throw error;
      }
    }

    try {
      await this.notificationsService.unregisterDevice({ chainId, uuid });
    } catch (error: unknown) {
      // The token might already have been removed from the TX service.
      // If this happens, the TX service will throw a 404 error, but it is safe to ignore it.
      const errorObject = error as { code?: number };
      if (errorObject?.code !== 404) {
        throw error;
      }
    }
  }

  @Delete('chains/:chainId/notifications/devices/:uuid/safes/:safeAddress')
  async unregisterSafe(
    @Param('chainId') chainId: string,
    @Param('uuid', new ValidationPipe(UuidSchema)) uuid: UUID,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<void> {
    if (this.isPushNotificationV2Enabled) {
      return this.unregisterSafeV2Compatible(chainId, uuid, safeAddress);
    }

    await this.notificationsService.unregisterSafe({
      chainId,
      uuid,
      safeAddress,
    });
  }

  private async unregisterSafeV2Compatible(
    chainId: string,
    uuid: UUID,
    safeAddress: `0x${string}`,
  ): Promise<void> {
    try {
      // Compatibility with V2
      await this.notificationServiceV2.deleteSubscription({
        deviceUuid: uuid,
        chainId: chainId,
        safeAddress: safeAddress,
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        // Do not throw a NotFound error when attempting to remove the token from the CGW,
        // This ensures the TX service remove method is called
      } else {
        throw error;
      }
    }

    try {
      await this.notificationsService.unregisterSafe({
        chainId,
        uuid,
        safeAddress,
      });
    } catch (error: unknown) {
      // The token might already have been removed from the TX service.
      // If this happens, the TX service will throw a 404 error, but it is safe to ignore it.
      const errorObject = error as { code?: number };
      if (errorObject?.code !== 404) {
        throw error;
      }
    }
  }
}
