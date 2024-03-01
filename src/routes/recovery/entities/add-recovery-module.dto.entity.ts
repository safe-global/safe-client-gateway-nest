import { ApiProperty } from '@nestjs/swagger';

export class AddRecoveryModuleDto {
  @ApiProperty()
  moduleAddress!: string;
}
