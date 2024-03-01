import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { SafeRegistration } from '@/routes/notifications/entities/safe-registration.entity';

export function safeRegistrationBuilder(): IBuilder<SafeRegistration> {
  return new Builder<SafeRegistration>()
    .with('chainId', faker.string.numeric())
    .with(
      'safes',
      faker.helpers.multiple(() => faker.finance.ethereumAddress(), {
        count: { min: 0, max: 5 },
      }),
    )
    .with(
      'signatures',
      faker.helpers.multiple(() => faker.string.hexadecimal({ length: 32 }), {
        count: { min: 0, max: 5 },
      }),
    );
}
