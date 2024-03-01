import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';

export function safeAppInfoBuilder(): IBuilder<SafeAppInfo> {
  return new Builder<SafeAppInfo>()
    .with('name', faker.word.words())
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}
