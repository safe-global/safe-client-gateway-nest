import { AddressBookItemNameSchema } from '@/domain/accounts/address-books/entities/schemas/address-book-item-name.schema';
import { faker } from '@faker-js/faker/.';
import { ZodError } from 'zod';

describe('AddressBookItemNameSchema', () => {
  it('should validate a valid address book item name', () => {
    const addressBookItemName = 'a-valid_AddressBookItem.name';

    const result = AddressBookItemNameSchema.safeParse(addressBookItemName);

    expect(result.success && result.data).toBe(addressBookItemName);
  });

  it('should not validate an non-string name', () => {
    const name = 123;

    const result = AddressBookItemNameSchema.safeParse(name);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: [],
          message: 'Expected string, received number',
        },
      ]),
    );
  });

  it('should not validate null name', () => {
    const result = AddressBookItemNameSchema.safeParse(null);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'null',
          path: [],
          message: 'Expected string, received null',
        },
      ]),
    );
  });

  it('should not validate an account name shorter than 3 characters', () => {
    const accountName = faker.string.alphanumeric(2);

    const result = AddressBookItemNameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_small',
          minimum: 3,
          type: 'string',
          inclusive: true,
          exact: false,
          message:
            'Address book entry names must be at least 3 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an account name larger than 50 characters', () => {
    const accountName = faker.string.alphanumeric(51);

    const result = AddressBookItemNameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_big',
          maximum: 50,
          type: 'string',
          inclusive: true,
          exact: false,
          message:
            'Address book entry names must be at most 50 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an account name containing not allowed characters', () => {
    const forbiddenCharsString = '!@#$%^&*()';
    const accountName = `${faker.string.alphanumeric(2)}${faker.string.fromCharacters(forbiddenCharsString)}${faker.string.alphanumeric(2)}`;

    const result = AddressBookItemNameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'regex',
          code: 'invalid_string',
          message:
            'Address book entry names must start with a letter or number and can contain alphanumeric characters, periods, underscores, or hyphens',
          path: [],
        },
      ]),
    );
  });
});
