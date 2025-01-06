import { ICounterfactualSafesRepository } from '@/domain/accounts/counterfactual-safes/counterfactual-safes.repository.interface';
import { CounterfactualSafe as DomainCounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { CounterfactualSafe } from '@/routes/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CounterfactualSafesService {
  constructor(
    @Inject(ICounterfactualSafesRepository)
    private readonly repository: ICounterfactualSafesRepository,
  ) {}

  async getCounterfactualSafe(args: {
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<CounterfactualSafe> {
    const domainCounterfactualSafe =
      await this.repository.getCounterfactualSafe(args);
    return this.mapCounterfactualSafe(domainCounterfactualSafe);
  }

  async getCounterfactualSafes(
    address: `0x${string}`,
  ): Promise<Array<CounterfactualSafe>> {
    const domainCounterfactualSafes =
      await this.repository.getCounterfactualSafes(address);
    return domainCounterfactualSafes.map((counterfactualSafe) =>
      this.mapCounterfactualSafe(counterfactualSafe),
    );
  }

  async createCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe> {
    const domainCounterfactualSafe =
      await this.repository.createCounterfactualSafe(args);
    return this.mapCounterfactualSafe(domainCounterfactualSafe);
  }

  async deleteCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<void> {
    await this.repository.deleteCounterfactualSafe(args);
  }

  async deleteCounterfactualSafes(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void> {
    await this.repository.deleteCounterfactualSafes(args);
  }

  private mapCounterfactualSafe(
    domainCounterfactualSafe: DomainCounterfactualSafe,
  ): CounterfactualSafe {
    return new CounterfactualSafe(
      domainCounterfactualSafe.chain_id,
      domainCounterfactualSafe.creator,
      domainCounterfactualSafe.fallback_handler,
      domainCounterfactualSafe.owners,
      domainCounterfactualSafe.predicted_address,
      domainCounterfactualSafe.salt_nonce,
      domainCounterfactualSafe.singleton_address,
      domainCounterfactualSafe.threshold,
    );
  }
}
