import { ApiProperty } from '@nestjs/swagger';

export class SafeNonces {
  @ApiProperty()
  readonly currentNonce: number;

  @ApiProperty()
  readonly recommendedNonce: number;

  constructor(args: { currentNonce: number; recommendedNonce: number }) {
    this.currentNonce = args.currentNonce;
    this.recommendedNonce = args.recommendedNonce;
  }
}
