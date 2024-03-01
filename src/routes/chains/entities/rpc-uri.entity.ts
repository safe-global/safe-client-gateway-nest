import { ApiProperty } from '@nestjs/swagger';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { RpcUri as DomainRpcUri } from '@/domain/chains/entities/rpc-uri.entity';

export class RpcUri implements DomainRpcUri {
  @ApiProperty({ enum: Object.values(RpcUriAuthentication) })
  authentication!: RpcUriAuthentication;
  @ApiProperty()
  value!: string;
}
