import { addressBookBuilder } from '@/domain/accounts/address-books/entities/__tests__/address-book.builder';
import { AddressBookSchema } from '@/domain/accounts/address-books/entities/address-book.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

describe('AddressBookSchema', () => {
  it('should verify an AddressBook', () => {
    const addressBook = addressBookBuilder().build();

    const result = AddressBookSchema.safeParse(addressBook);

    expect(result.success).toBe(true);
  });

  it('should not verify an AddressBook with a float accountId', () => {
    const addressBook = addressBookBuilder()
      .with('accountId', faker.number.float())
      .build();

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'integer',
        message: 'Expected integer, received float',
        path: ['accountId'],
        received: 'float',
      },
    ]);
  });

  it('should not verify an AddressBook with a number chainId', () => {
    const addressBook = addressBookBuilder()
      // @ts-expect-error - should be strings
      .with('chainId', faker.number.int())
      .build();

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Expected string, received number',
        path: ['chainId'],
        received: 'number',
      },
    ]);
  });

  it('should not verify an AddressBook with a string data', () => {
    const addressBook = addressBookBuilder()
      // @ts-expect-error - should be array
      .with('data', faker.string.alphanumeric())
      .build();

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Expected array, received string',
        path: ['data'],
        received: 'string',
      },
    ]);
  });

  it('should not verify an AddressBookItem with a float id', () => {
    const addressBook = addressBookBuilder().build();
    addressBook.data[0].id = faker.number.float({
      min: 1.01,
      max: DB_MAX_SAFE_INTEGER,
    });

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'integer',
        message: 'Expected integer, received float',
        path: ['data', 0, 'id'],
        received: 'float',
      },
    ]);
  });

  it('should not verify an AddressBookItem with a string id', () => {
    const addressBook = addressBookBuilder().build();
    // @ts-expect-error - should be numbers
    addressBook.data[0].id = faker.string.alphanumeric();

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['data', 0, 'id'],
        received: 'string',
      },
    ]);
  });

  it('should not verify an AddressBookItem with a shorter name', () => {
    const addressBook = addressBookBuilder().build();
    addressBook.data[0].name = 'e'; // min length is 3

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'too_small',
        exact: false,
        inclusive: true,
        message: 'Address book entry names must be at least 3 characters long',
        minimum: 3,
        path: ['data', 0, 'name'],
        type: 'string',
      },
    ]);
  });

  it('should not verify an AddressBookItem with a longer name', () => {
    const addressBook = addressBookBuilder().build();
    addressBook.data[0].name = 'e'.repeat(51); // max length is 50

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'too_big',
        exact: false,
        inclusive: true,
        message: 'Address book entry names must be at most 50 characters long',
        maximum: 50,
        path: ['data', 0, 'name'],
        type: 'string',
      },
    ]);
  });

  it('should not verify an AddressBookItem with a malformed name', () => {
    const addressBook = addressBookBuilder().build();
    addressBook.data[0].name = '////'; // must start with a letter or number

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_string',
        message:
          'Address book entry names must start with a letter or number and can contain alphanumeric characters, periods, underscores, or hyphens',
        path: ['data', 0, 'name'],
        validation: 'regex',
      },
    ]);
  });

  it('should not verify an AddressBookItem with a malformed address', () => {
    const addressBook = addressBookBuilder().build();
    addressBook.data[0].address = '0x123';

    const result = AddressBookSchema.safeParse(addressBook);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['data', 0, 'address'],
      },
    ]);
  });

  it('should checksum the address of an AddressBookItem', () => {
    const addressBook = addressBookBuilder().build();
    // @ts-expect-error - address should be `0x${string}`
    addressBook.data[0].address = addressBook.data[0].address.toLowerCase();

    const result = AddressBookSchema.safeParse(addressBook);

    expect(result.success && result.data.data[0].address).toBe(
      getAddress(addressBook.data[0].address),
    );
  });
});
