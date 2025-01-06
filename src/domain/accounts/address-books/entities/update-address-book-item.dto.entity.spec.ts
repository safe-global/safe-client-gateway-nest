import { updateAddressBookItemDtoBuilder } from '@/domain/accounts/address-books/entities/__tests__/update-address-book-item.dto.builder';
import { UpdateAddressBookItemDtoSchema } from '@/domain/accounts/address-books/entities/update-address-book-item.dto.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

describe('UpdateAddressBookItemDtoSchema', () => {
  it('should verify a UpdateAddressBookItemDto', () => {
    const updateAddressBookItemDto = updateAddressBookItemDtoBuilder().build();

    const result = UpdateAddressBookItemDtoSchema.safeParse(
      updateAddressBookItemDto,
    );

    expect(result.success).toBe(true);
  });

  it('should not verify an UpdateAddressBookItemDto with a shorter name', () => {
    const updateAddressBookItemDto = updateAddressBookItemDtoBuilder()
      .with('name', faker.string.alphanumeric({ length: 2 }))
      .build();

    const result = UpdateAddressBookItemDtoSchema.safeParse(
      updateAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'too_small',
        inclusive: true,
        exact: false,
        message: 'Address Books items names must be at least 3 characters long',
        minimum: 3,
        path: ['name'],
        type: 'string',
      },
    ]);
  });

  it('should not verify an UpdateAddressBookItemDto with a string id', () => {
    const updateAddressBookItemDto = updateAddressBookItemDtoBuilder()
      // @ts-expect-error - should be numbers
      .with('id', faker.string.alphanumeric())
      .build();

    const result = UpdateAddressBookItemDtoSchema.safeParse(
      updateAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['id'],
        received: 'string',
      },
    ]);
  });

  it('should not verify an UpdateAddressBookItemDto with a malformed address', () => {
    const updateAddressBookItemDto = updateAddressBookItemDtoBuilder()
      .with('address', '0x123')
      .build();

    const result = UpdateAddressBookItemDtoSchema.safeParse(
      updateAddressBookItemDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['address'],
      },
    ]);
  });

  it('should checksum the address of an UpdateAddressBookItemDto', () => {
    const updateAddressBookItemDto = updateAddressBookItemDtoBuilder().build();
    // @ts-expect-error - address should be `0x${string}`
    updateAddressBookItemDto.address =
      updateAddressBookItemDto.address.toLowerCase();

    const result = UpdateAddressBookItemDtoSchema.safeParse(
      updateAddressBookItemDto,
    );

    expect(result.success && result.data.address).toBe(
      getAddress(updateAddressBookItemDto.address),
    );
  });
});
