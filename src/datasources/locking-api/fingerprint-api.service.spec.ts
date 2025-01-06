import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import {
  fingerprintIpDataBuilder,
  fingerprintIpInfoBuilder,
  fingerprintLocationSpoofingBuilder,
  fingerprintUnsealedDataBuilder,
  fingerprintVpnBuilder,
} from '@/datasources/locking-api/entities/__tests__/fingerprint-unsealed-data.entity.builder';
import { FingerprintApiService } from '@/datasources/locking-api/fingerprint-api.service';
import { eligibilityRequestBuilder } from '@/domain/community/entities/__tests__/eligibility-request.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { unsealEventsResponse } from '@fingerprintjs/fingerprintjs-pro-server-api';

// TODO: convert to spy to avoid casting
jest.mock('@fingerprintjs/fingerprintjs-pro-server-api');

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('FingerprintApiService', () => {
  let service: FingerprintApiService;
  let fakeConfigurationService: FakeConfigurationService;
  const eligibilityEncryptionKey = faker.string.uuid();

  beforeEach(() => {
    jest.resetAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'locking.eligibility.fingerprintEncryptionKey',
      eligibilityEncryptionKey,
    );
    fakeConfigurationService.set(
      'locking.eligibility.nonEligibleCountryCodes',
      ['US'],
    );

    service = new FingerprintApiService(
      fakeConfigurationService,
      mockLoggingService,
    );
  });

  describe('checkEligibility', () => {
    it('should return isAllowed:true and isVpn:false for a non-VPN non-US location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: fingerprintIpInfoBuilder()
            .with('data', {
              v4: fingerprintIpDataBuilder()
                .with('geolocation', { country: { code: 'DE' } })
                .build(),
              v6: fingerprintIpDataBuilder()
                .with('geolocation', { country: { code: 'DE' } })
                .build(),
            })
            .build(),
          locationSpoofing: fingerprintLocationSpoofingBuilder()
            .with('data', { result: false })
            .build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: false, confidence: 'high' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: true,
        isVpn: false,
      });
    });

    it('should return isAllowed:false and isVpn:false for a non-VPN US location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: {
            data: {
              v4: fingerprintIpDataBuilder()
                .with('geolocation', { country: { code: 'US' } })
                .build(),
              v6: null,
            },
          },
          locationSpoofing: fingerprintLocationSpoofingBuilder()
            .with('data', { result: false })
            .build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: false, confidence: 'high' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: false,
      });
    });

    it('should return isAllowed:false and isVpn:true for a VPN US location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: {
            data: {
              v4: null,
              v6: fingerprintIpDataBuilder()
                .with('geolocation', { country: { code: 'US' } })
                .build(),
            },
          },
          locationSpoofing: fingerprintLocationSpoofingBuilder()
            .with('data', { result: false })
            .build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: true, confidence: 'high' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: true,
      });
    });

    it('should return isAllowed:true and isVpn:true for a VPN unknown location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: null,
          locationSpoofing: fingerprintLocationSpoofingBuilder()
            .with('data', { result: false })
            .build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: true, confidence: 'high' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: true,
        isVpn: true,
      });
    });

    it('should return isAllowed:true for a unknown location', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const vpn = fingerprintVpnBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: null,
          locationSpoofing: fingerprintLocationSpoofingBuilder()
            .with('data', { result: false })
            .build(),
          vpn,
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: true,
        isVpn: vpn.data?.result,
      });
    });

    it('should return isAllowed:false when location spoofing is detected', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const vpn = fingerprintVpnBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: fingerprintIpInfoBuilder().build(),
          locationSpoofing: fingerprintLocationSpoofingBuilder()
            .with('data', { result: true })
            .build(),
          vpn,
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: false,
        isVpn: vpn.data?.result,
      });
    });

    it('should return isVpn:false for a low confidence score', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: null,
          locationSpoofing: fingerprintLocationSpoofingBuilder().build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: true, confidence: 'low' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: expect.anything(),
        isVpn: false,
      });
    });

    it('should return isVpn:true for a medium confidence score', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: null,
          locationSpoofing: fingerprintLocationSpoofingBuilder().build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: true, confidence: 'medium' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: expect.anything(),
        isVpn: true,
      });
    });

    it('should return isVpn:true for a high confidence score', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: null,
          locationSpoofing: fingerprintLocationSpoofingBuilder().build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: true, confidence: 'high' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: expect.anything(),
        isVpn: true,
      });
    });

    it('should return isVpn:false for an unknown confidence score', async () => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      const unsealedData = fingerprintUnsealedDataBuilder()
        .with('products', {
          ipInfo: null,
          locationSpoofing: fingerprintLocationSpoofingBuilder().build(),
          vpn: fingerprintVpnBuilder()
            .with('data', { result: true, confidence: 'unknown' })
            .build(),
        })
        .build();
      (unsealEventsResponse as jest.Mock).mockResolvedValue(unsealedData);

      const result = await service.checkEligibility(eligibilityRequest);

      expect(result).toEqual({
        requestId: eligibilityRequest.requestId,
        isAllowed: expect.anything(),
        isVpn: false,
      });
    });
  });
});
