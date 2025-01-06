import { ApiProperty } from '@nestjs/swagger';

export class CounterfactualSafe {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  creator: `0x${string}`;
  @ApiProperty()
  fallbackHandler: `0x${string}`;
  @ApiProperty({ type: String, isArray: true })
  owners: Array<`0x${string}`>;
  @ApiProperty()
  predictedAddress: `0x${string}`;
  @ApiProperty()
  saltNonce: string;
  @ApiProperty()
  singletonAddress: `0x${string}`;
  @ApiProperty()
  threshold: number;

  constructor(
    chainId: string,
    creator: `0x${string}`,
    fallbackHandler: `0x${string}`,
    owners: Array<`0x${string}`>,
    predictedAddress: `0x${string}`,
    saltNonce: string,
    singletonAddress: `0x${string}`,
    threshold: number,
  ) {
    this.chainId = chainId;
    this.creator = creator;
    this.fallbackHandler = fallbackHandler;
    this.owners = owners;
    this.predictedAddress = predictedAddress;
    this.saltNonce = saltNonce;
    this.singletonAddress = singletonAddress;
    this.threshold = threshold;
  }
}
