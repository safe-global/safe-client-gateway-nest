import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { blockExplorerUriTemplateBuilder } from '@/domain/chains/entities/__tests__/block-explorer-uri-template.builder';
import { gasPriceFixedEIP1559Builder } from '@/domain/chains/entities/__tests__/gas-price-fixed-eip-1559.builder';
import { gasPriceFixedBuilder } from '@/domain/chains/entities/__tests__/gas-price-fixed.builder';
import { gasPriceOracleBuilder } from '@/domain/chains/entities/__tests__/gas-price-oracle.builder';
import { nativeCurrencyBuilder } from '@/domain/chains/entities/__tests__/native.currency.builder';
import { rpcUriBuilder } from '@/domain/chains/entities/__tests__/rpc-uri.builder';
import { themeBuilder } from '@/domain/chains/entities/__tests__/theme.builder';
import { Chain } from '@/domain/chains/entities/chain.entity';

export function chainBuilder(): IBuilder<Chain> {
  return new Builder<Chain>()
    .with('chainId', faker.string.numeric())
    .with('chainName', faker.company.name())
    .with('description', faker.word.words())
    .with('l2', faker.datatype.boolean())
    .with('shortName', faker.company.name())
    .with('rpcUri', rpcUriBuilder().build())
    .with('safeAppsRpcUri', rpcUriBuilder().build())
    .with('publicRpcUri', rpcUriBuilder().build())
    .with('blockExplorerUriTemplate', blockExplorerUriTemplateBuilder().build())
    .with('nativeCurrency', nativeCurrencyBuilder().build())
    .with('transactionService', faker.internet.url({ appendSlash: false }))
    .with('vpcTransactionService', faker.internet.url({ appendSlash: false }))
    .with('theme', themeBuilder().build())
    .with('gasPrice', [
      gasPriceFixedBuilder().build(),
      gasPriceFixedEIP1559Builder().build(),
      gasPriceOracleBuilder().build(),
    ])
    .with('ensRegistryAddress', faker.finance.ethereumAddress())
    .with('disabledWallets', [faker.word.sample(), faker.word.sample()])
    .with('features', [faker.word.sample(), faker.word.sample()])
    .with('recommendedMasterCopyVersion', faker.system.semver());
}
