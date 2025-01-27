import { AddressBookSchema } from '@/domain/accounts/address-books/entities/address-book.entity';
import { AddressBookItemNameSchema } from '@/domain/accounts/address-books/entities/schemas/address-book-item-name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const UpdateAddressBookItemDtoSchema = z.object({
  id: AddressBookSchema.shape.id,
  name: AddressBookItemNameSchema,
  address: AddressSchema,
});

export class UpdateAddressBookItemDto
  implements z.infer<typeof UpdateAddressBookItemDtoSchema>
{
  id: number;
  name: string;
  address: `0x${string}`;

  constructor(props: UpdateAddressBookItemDto) {
    this.id = props.id;
    this.name = props.name;
    this.address = props.address;
  }
}
