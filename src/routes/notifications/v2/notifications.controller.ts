import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { UpsertSubscriptionsDto } from '@/routes/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { UpsertSubscriptionsDtoSchema } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UUID } from 'crypto';
import { OptionalAuthGuard } from '@/routes/auth/guards/optional-auth.guard';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity.db';

@ApiTags('notifications')
@Controller({ path: '', version: '2' })
export class NotificationsControllerV2 {
  constructor(private readonly notificationsService: NotificationsServiceV2) {}

  @Post('register/notifications')
  @UseGuards(OptionalAuthGuard)
  upsertSubscriptions(
    @Body(new ValidationPipe(UpsertSubscriptionsDtoSchema))
    upsertSubscriptionsDto: UpsertSubscriptionsDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<{ deviceUuid: UUID }> {
    return this.notificationsService.upsertSubscriptions({
      authPayload,
      upsertSubscriptionsDto,
    });
  }

  @Get('chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress')
  @UseGuards(AuthGuard)
  getSafeSubscription(
    @Param('deviceUuid', new ValidationPipe(UuidSchema)) deviceUuid: UUID,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<NotificationType>> {
    return this.notificationsService.getSafeSubscription({
      authPayload,
      deviceUuid,
      chainId,
      safeAddress,
    });
  }

  @Delete(
    'chains/:chainId/notifications/devices/:deviceUuid/safes/:safeAddress',
  )
  deleteSubscription(
    @Param('deviceUuid', new ValidationPipe(UuidSchema)) deviceUuid: UUID,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<void> {
    return this.notificationsService.deleteSubscription({
      deviceUuid,
      chainId,
      safeAddress,
    });
  }

  @Delete('chains/:chainId/notifications/devices/:deviceUuid')
  deleteDevice(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) _chainId: string,
    @Param('deviceUuid', new ValidationPipe(UuidSchema)) deviceUuid: UUID,
  ): Promise<void> {
    return this.notificationsService.deleteDevice(deviceUuid);
  }
}
