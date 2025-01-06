import { CreateCounterfactualSafeDto as DomainCreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCounterfactualSafeDto
  implements DomainCreateCounterfactualSafeDto
{
  @ApiProperty()
  chainId!: string;
  @ApiProperty()
  fallbackHandler!: `0x${string}`;
  @ApiProperty()
  owners!: Array<`0x${string}`>;
  @ApiProperty()
  predictedAddress!: `0x${string}`;
  @ApiProperty()
  saltNonce!: string;
  @ApiProperty()
  singletonAddress!: `0x${string}`;
  @ApiProperty()
  threshold!: number;
}
