import { createAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/create-address-book-item.dto.builder';
import { CreateAddressBookItemDtoSchema } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

describe('CreateAddressBookItemDtoSchema', () => {
  it('should verify a CreateAddressBookItemDto', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder().build();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(result.success).toBe(true);
  });

  it('should not verify a CreateAddressBookItemDto with a shorter name', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder()
      .with('name', faker.string.alphanumeric({ length: 2 }))
      .build();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'too_small',
        inclusive: true,
        exact: false,
        message: 'Address book entry names must be at least 3 characters long',
        minimum: 3,
        path: ['name'],
        type: 'string',
      },
    ]);
  });

  it('should not verify a CreateAddressBookItemDto with a number name', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder()
      // @ts-expect-error - should be strings
      .with('name', faker.number.int())
      .build();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Expected string, received number',
        path: ['name'],
        received: 'number',
      },
    ]);
  });

  it('should not verify a CreateAddressBookItemDto with a longer name', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder()
      .with('name', faker.string.alphanumeric({ length: 51 }))
      .build();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'too_big',
        inclusive: true,
        exact: false,
        message: 'Address book entry names must be at most 50 characters long',
        maximum: 50,
        path: ['name'],
        type: 'string',
      },
    ]);
  });

  it('should not verify a CreateAddressBookItemDto with a malformed name', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder()
      .with('name', '////')
      .build();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_string',
        message:
          'Address book entry names must start with a letter or number and can contain alphanumeric characters, periods, underscores, or hyphens',
        path: ['name'],
        validation: 'regex',
      },
    ]);
  });

  it('should not verify a CreateAddressBookItemDto with a malformed address', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder()
      .with('address', '0x123')
      .build();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      },
    ]);
  });

  it('should checksum the address of a CreateAddressBookItemDto', () => {
    const createAddressBookItemDto = createAddressBookItemDtoBuilder().build();
    // @ts-expect-error - address should be `0x${string}`
    createAddressBookItemDto.address =
      createAddressBookItemDto.address.toLowerCase();

    const result = CreateAddressBookItemDtoSchema.safeParse(
      createAddressBookItemDto,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(createAddressBookItemDto.address),
    );
  });
});
