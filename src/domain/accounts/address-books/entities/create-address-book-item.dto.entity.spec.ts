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
