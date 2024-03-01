import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Transfer,
  TransferType,
} from '@/routes/transactions/entities/transfers/transfer.entity';

export class Erc721Transfer extends Transfer {
  @ApiProperty()
  tokenAddress: string;
  @ApiProperty()
  tokenId: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenName: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenSymbol: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;
  @ApiPropertyOptional({ type: Boolean, nullable: true })
  trusted: boolean | null;

  constructor(
    tokenAddress: string,
    tokenId: string,
    tokenName: string | null = null,
    tokenSymbol: string | null = null,
    logoUri: string | null = null,
    trusted: boolean | null = null,
  ) {
    super(TransferType.Erc721);
    this.tokenAddress = tokenAddress;
    this.tokenId = tokenId;
    this.tokenName = tokenName;
    this.tokenSymbol = tokenSymbol;
    this.logoUri = logoUri;
    this.trusted = trusted;
  }
}

export function isErc721Transfer(
  transfer: Transfer,
): transfer is Erc721Transfer {
  return transfer.type === TransferType.Erc721;
}
