import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { DeviceType } from '@/domain/notifications/v1/entities/device.entity';
import { SafeRegistration } from '@/routes/notifications/v1/entities/safe-registration.entity';

@ApiExtraModels(SafeRegistration)
export class RegisterDeviceDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  uuid?: string;
  @ApiProperty()
  cloudMessagingToken!: string;
  @ApiProperty()
  buildNumber!: string;
  @ApiProperty()
  bundle!: string;
  @ApiProperty()
  deviceType!: DeviceType;
  @ApiProperty()
  version!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  timestamp?: string;
  @ApiProperty({
    type: 'array',
    items: { $ref: getSchemaPath(SafeRegistration) },
  })
  safeRegistrations!: Array<SafeRegistration>;
}
