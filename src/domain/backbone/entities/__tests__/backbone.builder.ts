import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';

export function backboneBuilder(): IBuilder<Backbone> {
  return new Builder<Backbone>()
    .with('name', faker.word.sample())
    .with('version', faker.system.semver())
    .with('api_version', faker.system.semver())
    .with('secure', faker.datatype.boolean())
    .with('host', faker.internet.url({ appendSlash: false }))
    .with(
      'headers',
      Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () =>
        faker.word.sample(),
      ),
    )
    .with('settings', JSON.parse(fakeJson()));
}
