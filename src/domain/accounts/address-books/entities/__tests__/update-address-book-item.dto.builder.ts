import { Builder, type IBuilder } from '@/__tests__/builder';
import type { UpdateAddressBookItemDto } from '@/domain/accounts/address-books/entities/update-address-book-item.dto.entity';
import { accountNameBuilder } from '@/domain/accounts/entities/__tests__/account-name.builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function updateAddressBookItemDtoBuilder(): IBuilder<UpdateAddressBookItemDto> {
  return new Builder<UpdateAddressBookItemDto>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('name', accountNameBuilder())
    .with('address', getAddress(faker.finance.ethereumAddress()));
}
