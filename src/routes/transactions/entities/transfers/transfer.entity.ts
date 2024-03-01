import { ApiProperty } from '@nestjs/swagger';

export enum TransferType {
  NativeCoin = 'NATIVE_COIN',
  Erc20 = 'ERC20',
  Erc721 = 'ERC721',
}

export abstract class Transfer {
  @ApiProperty()
  type: TransferType;

  protected constructor(type: TransferType) {
    this.type = type;
  }
}
