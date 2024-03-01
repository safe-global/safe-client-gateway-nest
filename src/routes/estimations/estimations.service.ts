import { Inject, Injectable } from '@nestjs/common';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { EstimationsRepository } from '@/domain/estimations/estimations.repository';
import { IEstimationsRepository } from '@/domain/estimations/estimations.repository.interface';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { EstimationResponse } from '@/routes/estimations/entities/estimation-response.entity';

@Injectable()
export class EstimationsService {
  constructor(
    @Inject(IEstimationsRepository)
    private readonly estimationsRepository: EstimationsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
  ) {}

  /**
   * Returns an {@link Estimation}, and also the current and recommended next nonce to use.
   * The current nonce is the Safe nonce.
   * The next recommended nonce is the maximum between the current Safe nonce and the Safe
   * last transaction nonce plus 1. If there is no last transaction, the Safe nonce is returned.
   *
   * @returns {@link EstimationResponse} containing {@link Estimation}, and both
   * current and recommended next nonce values
   */
  async getEstimation(args: {
    chainId: string;
    address: string;
    getEstimationDto: GetEstimationDto;
  }): Promise<EstimationResponse> {
    const estimation = await this.estimationsRepository.getEstimation(args);
    const nonceState = await this.safeRepository.getNonces({
      chainId: args.chainId,
      safeAddress: args.address,
    });
    return new EstimationResponse(
      nonceState.currentNonce,
      nonceState.recommendedNonce,
      estimation.safeTxGas,
    );
  }
}
