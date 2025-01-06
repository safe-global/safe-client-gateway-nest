import { ApiProperty } from '@nestjs/swagger';

export class AddressBookItem {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  address: `0x${string}`;

  constructor(id: string, name: string, address: `0x${string}`) {
    this.id = id;
    this.name = name;
    this.address = address;
  }
}

export class AddressBook {
  @ApiProperty()
  id: string;
  @ApiProperty()
  accountId: string;
  @ApiProperty()
  chainId: string;
  @ApiProperty({ type: AddressBookItem, isArray: true })
  data: Array<AddressBookItem>;

  constructor(
    id: string,
    accountId: string,
    chainId: string,
    data: Array<AddressBookItem>,
  ) {
    this.id = id;
    this.accountId = accountId;
    this.chainId = chainId;
    this.data = data;
  }
}
