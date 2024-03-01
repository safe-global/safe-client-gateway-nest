import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import {
  SafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '@/domain/safe-apps/entities/safe-app-access-control.entity';

export function safeAppAccessControlBuilder(): IBuilder<SafeAppAccessControl> {
  return new Builder<SafeAppAccessControl>()
    .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
    .with(
      'value',
      faker.helpers.multiple(() => faker.internet.url({ appendSlash: false }), {
        count: { min: 2, max: 5 },
      }),
    );
}
