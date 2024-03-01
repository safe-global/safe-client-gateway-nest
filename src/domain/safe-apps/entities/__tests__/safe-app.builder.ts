import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { safeAppAccessControlBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-access-control.builder';
import { safeAppProviderBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-provider.builder';
import { safeAppSocialProfileBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app-social-profile.builder';
import { SafeApp } from '@/domain/safe-apps/entities/safe-app.entity';

export function safeAppBuilder(): IBuilder<SafeApp> {
  return new Builder<SafeApp>()
    .with('id', faker.number.int())
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample())
    .with('iconUrl', faker.internet.url({ appendSlash: false }))
    .with('description', faker.word.sample())
    .with('chainIds', [faker.number.int(), faker.number.int()])
    .with('provider', safeAppProviderBuilder().build())
    .with('accessControl', safeAppAccessControlBuilder().build())
    .with('tags', [faker.word.sample(), faker.word.sample()])
    .with('features', [faker.word.sample(), faker.word.sample()])
    .with('developerWebsite', faker.internet.url({ appendSlash: false }))
    .with(
      'socialProfiles',
      faker.helpers.multiple(() => safeAppSocialProfileBuilder().build(), {
        count: { min: 0, max: 5 },
      }),
    );
}
