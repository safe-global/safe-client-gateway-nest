import { ApiProperty } from '@nestjs/swagger';
import { BlockExplorerUriTemplate as DomainBlockExplorerUriTemplate } from '@/domain/chains/entities/block-explorer-uri-template.entity';

export class BlockExplorerUriTemplate
  implements DomainBlockExplorerUriTemplate
{
  @ApiProperty()
  address!: string;
  @ApiProperty()
  api!: string;
  @ApiProperty()
  txHash!: string;
}
