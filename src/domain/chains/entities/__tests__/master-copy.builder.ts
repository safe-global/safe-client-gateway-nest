import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { MasterCopy } from '@/domain/chains/entities/master-copies.entity';

export function masterCopyBuilder(): IBuilder<MasterCopy> {
  return new Builder<MasterCopy>()
    .with('address', faker.finance.ethereumAddress())
    .with('version', faker.system.semver())
    .with('deployer', faker.finance.ethereumAddress())
    .with('deployedBlockNumber', faker.number.int())
    .with('lastIndexedBlockNumber', faker.number.int())
    .with('l2', faker.datatype.boolean());
}
