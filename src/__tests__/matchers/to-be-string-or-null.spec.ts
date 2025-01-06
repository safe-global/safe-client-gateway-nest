import { expect } from '@jest/globals';
import '@/__tests__/matchers/to-be-string-or-null';
import { faker } from '@faker-js/faker';

describe('anyStringOrNull', () => {
  it.each([faker.string.sample(), null])(
    'should pass when the input is %s',
    (input) => {
      expect(input).anyStringOrNull();
    },
  );

  it.each([
    faker.number.int(),
    faker.datatype.boolean(),
    {},
    [],
    undefined,
    (): void => {},
  ])('should fail when the input is %s', (input) => {
    expect(() => expect(input).anyStringOrNull()).toThrow(
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      `expected ${input} to be string or null`,
    );
  });
});
