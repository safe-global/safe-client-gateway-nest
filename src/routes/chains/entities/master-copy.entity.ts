import { ApiProperty } from '@nestjs/swagger';

export class MasterCopy {
  @ApiProperty()
  address!: string;
  @ApiProperty()
  version!: string;
}
