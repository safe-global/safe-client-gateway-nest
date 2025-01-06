import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  NativeCurrency,
  NativeCurrency as ApiNativeCurrency,
} from '@/routes/chains/entities/native-currency.entity';
import {
  BlockExplorerUriTemplate,
  BlockExplorerUriTemplate as ApiBlockExplorerUriTemplate,
} from '@/routes/chains/entities/block-explorer-uri-template.entity';
import {
  BeaconChainExplorerUriTemplate,
  BeaconChainExplorerUriTemplate as ApiBeaconChainExplorerUriTemplate,
} from '@/domain/chains/entities/beacon-chain-explorer-uri-template.entity';
import {
  GasPriceOracle,
  GasPriceOracle as ApiGasPriceOracle,
} from '@/routes/chains/entities/gas-price-oracle.entity';
import {
  GasPriceFixed,
  GasPriceFixed as ApiGasPriceFixed,
} from '@/routes/chains/entities/gas-price-fixed.entity';
import {
  GasPriceFixedEIP1559,
  GasPriceFixedEIP1559 as ApiGasPriceFixedEIP1559,
} from '@/routes/chains/entities/gas-price-fixed-eip-1559.entity';
import {
  RpcUri,
  RpcUri as ApiRpcUri,
} from '@/routes/chains/entities/rpc-uri.entity';
import {
  Theme,
  Theme as ApiTheme,
} from '@/routes/chains/entities/theme.entity';
import { BalancesProvider } from '@/routes/chains/entities/balances-provider.entity';
import { ContractAddresses } from '@/routes/chains/entities/contract-addresses.entity';

@ApiExtraModels(ApiGasPriceOracle, ApiGasPriceFixed, ApiGasPriceFixedEIP1559)
export class Chain {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  chainName: string;
  @ApiProperty()
  description: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  chainLogoUri: string | null;
  @ApiProperty()
  l2: boolean;
  @ApiProperty()
  isTestnet: boolean;
  @ApiProperty()
  nativeCurrency: ApiNativeCurrency;
  @ApiProperty()
  transactionService: string;
  @ApiProperty()
  blockExplorerUriTemplate: ApiBlockExplorerUriTemplate;
  @ApiProperty()
  beaconChainExplorerUriTemplate: ApiBeaconChainExplorerUriTemplate;
  @ApiProperty()
  disabledWallets: Array<string>;
  @ApiPropertyOptional({ type: String, nullable: true })
  ensRegistryAddress: `0x${string}` | null;
  @ApiProperty()
  balancesProvider: BalancesProvider;
  @ApiProperty()
  contractAddresses: ContractAddresses;
  @ApiProperty()
  features: Array<string>;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(ApiGasPriceOracle) },
        { $ref: getSchemaPath(ApiGasPriceFixed) },
        { $ref: getSchemaPath(ApiGasPriceFixedEIP1559) },
      ],
    },
  })
  gasPrice: Array<
    ApiGasPriceOracle | ApiGasPriceFixed | ApiGasPriceFixedEIP1559
  >;
  @ApiProperty()
  publicRpcUri: ApiRpcUri;
  @ApiProperty()
  rpcUri: ApiRpcUri;
  @ApiProperty()
  safeAppsRpcUri: ApiRpcUri;
  @ApiProperty()
  shortName: string;
  @ApiProperty()
  theme: ApiTheme;
  @ApiPropertyOptional({ type: String, nullable: true })
  recommendedMasterCopyVersion: string | null;

  constructor(args: {
    chainId: string;
    chainName: string;
    description: string;
    l2: boolean;
    nativeCurrency: NativeCurrency;
    transactionService: string;
    blockExplorerUriTemplate: BlockExplorerUriTemplate;
    beaconChainExplorerUriTemplate: BeaconChainExplorerUriTemplate;
    disabledWallets: Array<string>;
    features: Array<string>;
    gasPrice: Array<GasPriceOracle | GasPriceFixed | GasPriceFixedEIP1559>;
    publicRpcUri: RpcUri;
    rpcUri: RpcUri;
    safeAppsRpcUri: RpcUri;
    shortName: string;
    theme: Theme;
    ensRegistryAddress: `0x${string}` | null;
    isTestnet: boolean;
    chainLogoUri: string | null;
    balancesProvider: BalancesProvider;
    contractAddresses: ContractAddresses;
    recommendedMasterCopyVersion: string | null;
  }) {
    this.chainId = args.chainId;
    this.chainName = args.chainName;
    this.description = args.description;
    this.chainLogoUri = args.chainLogoUri;
    this.l2 = args.l2;
    this.isTestnet = args.isTestnet;
    this.nativeCurrency = args.nativeCurrency;
    this.transactionService = args.transactionService;
    this.blockExplorerUriTemplate = args.blockExplorerUriTemplate;
    this.beaconChainExplorerUriTemplate = args.beaconChainExplorerUriTemplate;
    this.disabledWallets = args.disabledWallets;
    this.ensRegistryAddress = args.ensRegistryAddress;
    this.features = args.features;
    this.gasPrice = args.gasPrice;
    this.publicRpcUri = args.publicRpcUri;
    this.rpcUri = args.rpcUri;
    this.safeAppsRpcUri = args.safeAppsRpcUri;
    this.shortName = args.shortName;
    this.theme = args.theme;
    this.balancesProvider = args.balancesProvider;
    this.contractAddresses = args.contractAddresses;
    this.recommendedMasterCopyVersion = args.recommendedMasterCopyVersion;
  }
}
