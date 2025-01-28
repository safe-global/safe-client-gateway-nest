import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

// Assets

export const PortfolioAssetSchema = z.object({
  balance: NumericStringSchema,
  decimal: z.coerce.number(),
  name: z.string(),
  price: NumericStringSchema,
  symbol: z.string(),
  value: NumericStringSchema,
  contract: AddressSchema,
  imgSmall: z.string().url(),
});

export type PortfolioAsset = z.infer<typeof PortfolioAssetSchema>;

// Positions

export const NestedProtocolPositionSchema = z.object({
  name: z.string(),
  value: NumericStringSchema,
  healthRate: NumericStringSchema.optional(),
  assets: z.array(PortfolioAssetSchema),
  borrowAssets: z.array(PortfolioAssetSchema).optional(),
  dexAssets: z.array(PortfolioAssetSchema).optional(),
  rewardAssets: z.array(PortfolioAssetSchema).optional(),
  supplyAssets: z.array(PortfolioAssetSchema).optional(),
});

export type NestedProtocolPosition = z.infer<
  typeof NestedProtocolPositionSchema
>;

/**
 * "regular" positions have assets, and no protocolPositions
 * "complex" positions have no assets, and protocolPositions
 *
 * Splitting this into "regular" and "complex" schemas proved difficult
 * as WALLET position type can have no assets or protocolPositions
 */
export const ProtocolPositionSchema = z.object({
  name: z.string(),
  assets: z.array(PortfolioAssetSchema),
  protocolPositions: z.array(NestedProtocolPositionSchema),
  totalValue: NumericStringSchema,
});

export type ProtocolPosition = z.infer<typeof ProtocolPositionSchema>;

export const ProtocolPositionType = [
  'DEPOSIT',
  'FARMING',
  'GOVERNANCE',
  'INSURANCEBUYER',
  'INSURANCESELLER',
  'INVESTMENT',
  'LENDING',
  'LEVERAGE',
  'LEVERAGED FARMING',
  'LIQUIDITYPOOL',
  'LOCKED',
  'MARGIN',
  'MARGINPS',
  'NFTBORROWER',
  'NFTFRACTION',
  'NFTLENDER',
  'NFTLENDING',
  'NFTLIQUIDITYPOOL',
  'NFTSTAKED',
  'OPTIONSBUYER',
  'OPTIONSSELLER',
  'PERPETUALS',
  'REWARDS',
  'SPOT',
  'STAKED',
  'VAULT',
  'VAULTPS',
  'VESTING',
  'WALLET',
  'YIELD',
] as const;

export const ProtocolPositionsSchema = z.record(
  z.enum(ProtocolPositionType),
  ProtocolPositionSchema,
);

export type ProtocolPositions = z.infer<typeof ProtocolPositionsSchema>;

export const ProtocolChainKeys = [
  'ancient8',
  'arbitrum',
  'arbitrum_nova',
  'aurora',
  'avalanche',
  'base',
  'binance',
  'blast',
  'bob',
  'boba',
  'celo',
  'core',
  'cronos',
  'era', // zkSync Era
  'ethereum',
  'fantom',
  'fraxtal',
  'gnosis',
  'hyperliquid',
  'kava',
  'kroma',
  'linea',
  'manta',
  'mantle',
  'metis',
  'mint',
  'mode',
  'optimism',
  'polygon',
  'polygon_zkevm',
  'rari',
  'scroll',
  'solana',
  'taiko',
  'wc', // World Chain
  'xlayer',
  'zora',
] as const;

export const AssetByProtocolChainSchema = z.record(
  z.enum(ProtocolChainKeys),
  z.object({
    protocolPositions: ProtocolPositionsSchema,
  }),
);

export const AssetByProtocolSchema = z.object({
  chains: AssetByProtocolChainSchema,
  name: z.string(),
  imgLarge: z.string().url(),
  value: NumericStringSchema,
});

export type AssetByProtocol = z.infer<typeof AssetByProtocolSchema>;

// Protocols

// aave2, compound, convex, etc.
const ProtocolNameSchema = z.string();

export const PortfolioSchema = z.object({
  assetByProtocols: z.record(ProtocolNameSchema, AssetByProtocolSchema),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
