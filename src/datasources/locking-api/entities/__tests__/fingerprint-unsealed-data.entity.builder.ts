import { faker } from '@faker-js/faker';
import type { IBuilder } from '../../../../__tests__/builder';
import { Builder } from '../../../../__tests__/builder';
import type {
  FingerprintIpData,
  FingerprintIpInfo,
  FingerprintLocationSpoofing,
  FingerprintUnsealedData,
  FingerprintVpn,
} from '@/datasources/locking-api/entities/fingerprint-unsealed-data.entity';

export function fingerprintLocationSpoofingBuilder(): IBuilder<FingerprintLocationSpoofing> {
  return new Builder<FingerprintLocationSpoofing>().with('data', {
    result: faker.datatype.boolean(),
  });
}

export function fingerprintVpnBuilder(): IBuilder<FingerprintVpn> {
  return new Builder<FingerprintVpn>().with('data', {
    result: faker.datatype.boolean(),
    confidence: 'high',
  });
}

export function fingerprintIpDataBuilder(): IBuilder<FingerprintIpData> {
  return new Builder<FingerprintIpData>().with('geolocation', {
    country: {
      code: faker.location.countryCode(),
    },
  });
}

export function fingerprintIpInfoBuilder(): IBuilder<FingerprintIpInfo> {
  return new Builder<FingerprintIpInfo>().with('data', {
    v4: fingerprintIpDataBuilder().build(),
    v6: fingerprintIpDataBuilder().build(),
  });
}

export function fingerprintUnsealedDataBuilder(): IBuilder<FingerprintUnsealedData> {
  return new Builder<FingerprintUnsealedData>().with('products', {
    ipInfo: fingerprintIpInfoBuilder().build(),
    locationSpoofing: fingerprintLocationSpoofingBuilder().build(),
    vpn: fingerprintVpnBuilder().build(),
  });
}
