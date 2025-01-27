import { AddressBookItemNameSchema } from '@/domain/accounts/address-books/entities/schemas/address-book-item-name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const UpdateAddressBookItemDtoSchema = z.object({
  name: AddressBookItemNameSchema,
  address: AddressSchema,
});

export class UpdateAddressBookItemDto
  implements z.infer<typeof UpdateAddressBookItemDtoSchema>
{
  @ApiProperty()
  name!: string;
  @ApiProperty()
  address!: `0x${string}`;
}
