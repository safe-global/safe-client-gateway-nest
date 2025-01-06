import { z } from 'zod';

export const FingerprintLocationSpoofingSchema = z.object({
  data: z.object({ result: z.boolean() }).nullish().default(null),
});

export type FingerprintLocationSpoofing = z.infer<
  typeof FingerprintLocationSpoofingSchema
>;

export const FingerprintIpDataSchema = z.object({
  geolocation: z.object({
    country: z.object({ code: z.string() }).nullish().default(null),
  }),
});

export type FingerprintIpData = z.infer<typeof FingerprintIpDataSchema>;

export const FingerprintIpInfoSchema = z.object({
  data: z
    .object({
      v4: FingerprintIpDataSchema.nullish().default(null),
      v6: FingerprintIpDataSchema.nullish().default(null),
    })
    .nullish()
    .default(null),
});

export type FingerprintIpInfo = z.infer<typeof FingerprintIpInfoSchema>;

export const FingerprintConfidenceLevels = ['low', 'medium', 'high'] as const;

export const FingerprintVpnSchema = z.object({
  data: z
    .object({
      result: z.boolean(),
      confidence: z
        .enum([...FingerprintConfidenceLevels, 'unknown'])
        .catch('unknown'),
    })
    .nullish()
    .default(null),
});

export type FingerprintVpn = z.infer<typeof FingerprintVpnSchema>;

export const FingerprintUnsealedDataSchema = z.object({
  products: z.object({
    locationSpoofing: FingerprintLocationSpoofingSchema.nullish().default(null),
    ipInfo: FingerprintIpInfoSchema.nullish().default(null),
    vpn: FingerprintVpnSchema.nullish().default(null),
  }),
});

export type FingerprintUnsealedData = z.infer<
  typeof FingerprintUnsealedDataSchema
>;
