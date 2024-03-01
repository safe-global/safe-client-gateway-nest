import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { RpcUri } from '@/domain/chains/entities/rpc-uri.entity';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';

export function rpcUriBuilder(): IBuilder<RpcUri> {
  return new Builder<RpcUri>()
    .with('authentication', RpcUriAuthentication.NoAuthentication)
    .with('value', faker.internet.url({ appendSlash: false }));
}
