import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Theme } from '@/domain/chains/entities/theme.entity';

export function themeBuilder(): IBuilder<Theme> {
  return new Builder<Theme>()
    .with('textColor', faker.color.rgb())
    .with('backgroundColor', faker.color.rgb());
}
