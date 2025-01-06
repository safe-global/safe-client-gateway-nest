import { z } from 'zod';

export type AssetPrice = z.infer<typeof AssetPriceSchema>;

export const AssetPriceSchema = z.record(z.record(z.number().nullable()));

export const AssetPricesSchema = z.array(AssetPriceSchema);
