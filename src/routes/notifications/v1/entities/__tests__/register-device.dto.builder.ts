import { faker } from '@faker-js/faker';
import { DeviceType } from '@/domain/notifications/v1/entities/device.entity';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { safeRegistrationBuilder } from '@/routes/notifications/v1/entities/__tests__/safe-registration.builder';
import type { UUID } from 'crypto';

export async function registerDeviceDtoBuilder(args: {
  uuid: UUID;
  cloudMessagingToken: UUID;
  timestamp: number;
}): Promise<IBuilder<RegisterDeviceDto>> {
  const signaturePrefix = 'gnosis-safe';
  const safeRegistrations = await safeRegistrationBuilder({
    signaturePrefix,
    ...args,
  });

  return new Builder<RegisterDeviceDto>()
    .with('uuid', args.uuid)
    .with('cloudMessagingToken', args.cloudMessagingToken)
    .with('buildNumber', faker.string.numeric())
    .with('bundle', faker.internet.domainName())
    .with('deviceType', faker.helpers.objectValue(DeviceType))
    .with('version', faker.system.semver())
    .with('timestamp', args.timestamp.toString())
    .with(
      'safeRegistrations',
      faker.helpers.multiple(() => safeRegistrations.build(), {
        count: { min: 0, max: 10 },
      }),
    );
}
