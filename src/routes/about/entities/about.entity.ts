import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class About {
  @ApiProperty()
  name!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  version!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  buildNumber!: string | null;
}
