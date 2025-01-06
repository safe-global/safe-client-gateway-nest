import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  FingerprintUnsealedData,
  FingerprintUnsealedDataSchema,
} from '@/datasources/locking-api/entities/fingerprint-unsealed-data.entity';
import type { EligibilityRequest } from '@/domain/community/entities/eligibility-request.entity';
import type { Eligibility } from '@/domain/community/entities/eligibility.entity';
import type { IIdentityApi } from '@/domain/interfaces/identity-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  DecryptionAlgorithm,
  unsealEventsResponse,
} from '@fingerprintjs/fingerprintjs-pro-server-api';
import { Inject } from '@nestjs/common';

export class FingerprintApiService implements IIdentityApi {
  private readonly eligibilityEncryptionKey: string;
  private readonly nonEligibleCountryCodes: Array<string>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.eligibilityEncryptionKey =
      this.configurationService.getOrThrow<string>(
        'locking.eligibility.fingerprintEncryptionKey',
      );
    this.nonEligibleCountryCodes = this.configurationService.getOrThrow<
      Array<string>
    >('locking.eligibility.nonEligibleCountryCodes');
  }

  async checkEligibility(
    eligibilityRequest: EligibilityRequest,
  ): Promise<Eligibility> {
    const { requestId, sealedData } = eligibilityRequest;
    const unsealedData = await this.getUnsealedData(sealedData);
    return {
      requestId,
      isAllowed: this.isAllowed(unsealedData),
      isVpn: this.isVpn(unsealedData),
    };
  }

  private async getUnsealedData(
    sealedData: string,
  ): Promise<FingerprintUnsealedData> {
    const key = Buffer.from(this.eligibilityEncryptionKey, 'base64');
    const sealedDataBuffer = Buffer.from(sealedData, 'base64');
    const res = await unsealEventsResponse(sealedDataBuffer, [
      { key, algorithm: DecryptionAlgorithm.Aes256Gcm },
    ]);
    return FingerprintUnsealedDataSchema.parse(res);
  }

  /**
   * Determines if the unsealed data indicates an allowed (and not spoofed) location.
   *
   * @param unsealedData - The unsealed data for the eligibility check.
   * @returns true if the location is not spoofed and the country is eligible, false otherwise.
   */
  private isAllowed(unsealedData: FingerprintUnsealedData): boolean {
    const isSpoofedLocation =
      unsealedData.products.locationSpoofing?.data?.result === true;
    if (isSpoofedLocation) return false; // Early return if the location is spoofed.
    const ipCountryCodes = [
      unsealedData.products.ipInfo?.data?.v4?.geolocation.country?.code ?? null,
      unsealedData.products.ipInfo?.data?.v6?.geolocation.country?.code ?? null,
    ];
    // Both IP geolocation results must be either null or not in the non-eligible countries list.
    return ipCountryCodes.every(
      (code) => code === null || !this.nonEligibleCountryCodes.includes(code),
    );
  }

  private isVpn(unsealedData: FingerprintUnsealedData): boolean {
    return (
      unsealedData.products.vpn?.data?.result === true &&
      (unsealedData.products.vpn?.data?.confidence === 'medium' ||
        unsealedData.products.vpn?.data?.confidence === 'high')
    );
  }
}
