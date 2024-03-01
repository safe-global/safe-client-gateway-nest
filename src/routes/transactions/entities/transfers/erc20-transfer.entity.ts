import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Transfer,
  TransferType,
} from '@/routes/transactions/entities/transfers/transfer.entity';

export class Erc20Transfer extends Transfer {
  @ApiProperty()
  tokenAddress: string;
  @ApiProperty()
  value: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenName: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  tokenSymbol: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  decimals: number | null;
  @ApiPropertyOptional({ type: Boolean, nullable: true })
  trusted: boolean | null;

  constructor(
    tokenAddress: string,
    value: string,
    tokenName: string | null = null,
    tokenSymbol: string | null = null,
    logoUri: string | null = null,
    decimals: number | null = null,
    trusted: boolean | null = null,
  ) {
    super(TransferType.Erc20);
    this.tokenAddress = tokenAddress;
    this.value = value;
    this.tokenName = tokenName;
    this.tokenSymbol = tokenSymbol;
    this.logoUri = logoUri;
    this.decimals = decimals;
    this.trusted = trusted;
  }
}

export function isErc20Transfer(transfer: Transfer): transfer is Erc20Transfer {
  return transfer.type === TransferType.Erc20;
}
