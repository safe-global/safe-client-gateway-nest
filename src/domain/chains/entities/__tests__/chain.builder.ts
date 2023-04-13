import { faker } from '@faker-js/faker';
import { Chain } from '../chain.entity';
import { nativeCurrencyBuilder } from './native.currency.builder';
import { blockExplorerUriTemplateBuilder } from './block-explorer-uri-template.builder';
import { themeBuilder } from './theme.builder';
import { gasPriceFixedBuilder } from './gas-price-fixed.builder';
import { gasPriceOracleBuilder } from './gas-price-oracle.builder';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { rpcUriBuilder } from './rpc-uri.builder';

export function chainBuilder(): IBuilder<Chain> {
  return Builder.new<Chain>()
    .with('chainId', faker.random.numeric())
    .with('chainName', faker.company.name())
    .with('description', faker.random.words())
    .with('l2', faker.datatype.boolean())
    .with('shortName', faker.company.companySuffix())
    .with('rpcUri', rpcUriBuilder().build())
    .with('safeAppsRpcUri', rpcUriBuilder().build())
    .with('publicRpcUri', rpcUriBuilder().build())
    .with('blockExplorerUriTemplate', blockExplorerUriTemplateBuilder().build())
    .with('nativeCurrency', nativeCurrencyBuilder().build())
    .with('transactionService', faker.internet.url())
    .with('vpcTransactionService', faker.internet.url())
    .with('theme', themeBuilder().build())
    .with('gasPrice', [
      gasPriceFixedBuilder().build(),
      gasPriceOracleBuilder().build(),
    ])
    .with('ensRegistryAddress', faker.finance.ethereumAddress())
    .with('disabledWallets', [faker.random.word(), faker.random.word()])
    .with('features', [faker.random.word(), faker.random.word()])
    .with('recommendedMasterCopyVersion', faker.system.semver());
}
