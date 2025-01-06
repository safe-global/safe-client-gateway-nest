import {
  fingerprintIpDataBuilder,
  fingerprintIpInfoBuilder,
  fingerprintLocationSpoofingBuilder,
  fingerprintUnsealedDataBuilder,
  fingerprintVpnBuilder,
} from '@/datasources/locking-api/entities/__tests__/fingerprint-unsealed-data.entity.builder';
import {
  FingerprintIpDataSchema,
  FingerprintIpInfoSchema,
  FingerprintLocationSpoofingSchema,
  FingerprintUnsealedDataSchema,
  FingerprintVpnSchema,
} from '@/datasources/locking-api/entities/fingerprint-unsealed-data.entity';
import { ZodError } from 'zod';
import { faker } from '@faker-js/faker';

describe('FingerprintUnsealedData schemas', () => {
  describe('FingerprintUnsealedDataEntity', () => {
    it('should validate a FingerprintUnsealedDataEntity', () => {
      const fingerprintUnsealedDataEntity =
        fingerprintUnsealedDataBuilder().build();

      const result = FingerprintUnsealedDataSchema.safeParse(
        fingerprintUnsealedDataEntity,
      );

      expect(result.success).toBe(true);
    });

    it.each(['locationSpoofing' as const, 'ipInfo' as const, 'vpn' as const])(
      'should allow undefined %s, defaulting to null',
      (key) => {
        const fingerprintUnsealedDataEntity =
          fingerprintUnsealedDataBuilder().build();
        delete fingerprintUnsealedDataEntity.products[key];

        const result = FingerprintUnsealedDataSchema.safeParse(
          fingerprintUnsealedDataEntity,
        );

        expect(result.success && result.data.products[key]).toBe(null);
      },
    );
  });

  describe('FingerprintIpInfo', () => {
    it('should validate a FingerprintIpInfo', () => {
      const fingerprintIpInfo = fingerprintIpInfoBuilder().build();

      const result = FingerprintIpInfoSchema.safeParse(fingerprintIpInfo);

      expect(result.success).toBe(true);
    });

    it.each(['v4' as const, 'v6' as const])(
      'should allow undefined %s, defaulting to null',
      (key) => {
        const fingerprintIpInfo = fingerprintIpInfoBuilder().build();
        // @ts-expect-error - inferred types don't allow optional fields
        delete fingerprintIpInfo.data[key];

        const result = FingerprintIpInfoSchema.safeParse(fingerprintIpInfo);

        expect(
          result.success && result?.data?.data && result?.data?.data[key],
        ).toBe(null);
      },
    );
  });

  describe('FingerprintIpDataSchema', () => {
    it('should validate a FingerprintIpData', () => {
      const fingerprintIpData = fingerprintIpDataBuilder().build();

      const result = FingerprintIpDataSchema.safeParse(fingerprintIpData);

      expect(result.success).toBe(true);
    });

    it('should allow undefined country, defaulting to null', () => {
      const fingerprintIpData = fingerprintIpDataBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete fingerprintIpData.geolocation.country;

      const result = FingerprintIpDataSchema.safeParse(fingerprintIpData);

      expect(
        result.success &&
          result.data.geolocation &&
          result.data.geolocation.country,
      ).toBe(null);
    });

    it('should not allow non-string country', () => {
      const fingerprintIpData = fingerprintIpDataBuilder().build();
      // @ts-expect-error - value is expected to be a string
      fingerprintIpData.geolocation.country.code = 123;

      const result = FingerprintIpDataSchema.safeParse(fingerprintIpData);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['geolocation', 'country', 'code'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });

  describe('FingerprintLocationSpoofingSchema', () => {
    it('should validate a FingerprintLocationSpoofing', () => {
      const fingerprintLocationSpoofing =
        fingerprintLocationSpoofingBuilder().build();

      const result = FingerprintLocationSpoofingSchema.safeParse(
        fingerprintLocationSpoofing,
      );

      expect(result.success).toBe(true);
    });

    it('should allow undefined data, defaulting to null', () => {
      const fingerprintLocationSpoofing =
        fingerprintLocationSpoofingBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete fingerprintLocationSpoofing.data;

      const result = FingerprintLocationSpoofingSchema.safeParse(
        fingerprintLocationSpoofing,
      );

      expect(result.success && result.data.data).toBe(null);
    });

    it('should not allow non-boolean result', () => {
      const fingerprintLocationSpoofing =
        fingerprintLocationSpoofingBuilder().build();
      // @ts-expect-error - value is expected to be a boolean
      fingerprintLocationSpoofing.data.result = 'true';

      const result = FingerprintLocationSpoofingSchema.safeParse(
        fingerprintLocationSpoofing,
      );

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'string',
            path: ['data', 'result'],
            message: 'Expected boolean, received string',
          },
        ]),
      );
    });
  });

  describe('FingerprintVpnSchema', () => {
    it('should validate a FingerprintVpnSchema', () => {
      const fingerprintVpn = fingerprintVpnBuilder().build();

      const result = FingerprintVpnSchema.safeParse(fingerprintVpn);

      expect(result.success).toBe(true);
    });

    it('should allow undefined data, defaulting to null', () => {
      const fingerprintVpn = fingerprintVpnBuilder().build();

      // @ts-expect-error - inferred types don't allow optional fields
      delete fingerprintVpn.data;

      const result = FingerprintVpnSchema.safeParse(fingerprintVpn);

      expect(result.success && result.data.data).toBe(null);
    });

    it('should fallback to unknown for an invalid confidence value', () => {
      const fingerprintVpn = {
        data: {
          ...fingerprintVpnBuilder().build().data,
          confidence: faker.string.sample(),
        },
      };

      const result = FingerprintVpnSchema.safeParse(fingerprintVpn);

      expect(result.success && result.data.data?.confidence).toEqual('unknown');
    });

    it('should not allow non-boolean result', () => {
      const fingerprintVpn = fingerprintVpnBuilder().build();

      // @ts-expect-error - value is expected to be a boolean
      fingerprintVpn.data.result = 'true';

      const result =
        FingerprintLocationSpoofingSchema.safeParse(fingerprintVpn);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'string',
            path: ['data', 'result'],
            message: 'Expected boolean, received string',
          },
        ]),
      );
    });
  });
});
