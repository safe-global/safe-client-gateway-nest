import { Builder, IBuilder } from '@/__tests__/builder';
import {
  RichAddressFragment,
  RichTokenValueFragment,
  RichTextFragment,
  RichDecodedInfoFragment,
  RichFragmentType,
} from '@/routes/transactions/entities/human-description.entity';
import { faker } from '@faker-js/faker';

function richTokenValueFragmentBuilder(): IBuilder<RichTokenValueFragment> {
  return new Builder<RichTokenValueFragment>()
    .with('type', RichFragmentType.TokenValue)
    .with('value', faker.string.numeric())
    .with('symbol', faker.finance.currencySymbol())
    .with('logoUri', faker.internet.avatar());
}

function richTextFragmentBuilder(): IBuilder<RichTextFragment> {
  return new Builder<RichTextFragment>()
    .with('type', RichFragmentType.Text)
    .with('value', faker.word.words());
}

function richAddressFragmentBuilder(): IBuilder<RichAddressFragment> {
  return new Builder<RichAddressFragment>()
    .with('type', RichFragmentType.Address)
    .with('value', faker.finance.ethereumAddress());
}

const humanDescriptionBuilders: Array<() => IBuilder<RichDecodedInfoFragment>> =
  [
    richTokenValueFragmentBuilder,
    richTextFragmentBuilder,
    richAddressFragmentBuilder,
  ];

export function buildHumanDescription(): RichDecodedInfoFragment[] {
  return Array.from({ length: faker.number.int({ min: 0, max: 6 }) }, () =>
    faker.helpers.arrayElement(humanDescriptionBuilders)().build(),
  );
}
