import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { CounterfactualSafesRepository } from '@/domain/accounts/counterfactual-safes/counterfactual-safes.repository';
import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Module } from '@nestjs/common';

export const ICounterfactualSafesRepository = Symbol(
  'ICounterfactualSafesRepository',
);

export interface ICounterfactualSafesRepository {
  getCounterfactualSafe(args: {
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafes(
    address: `0x${string}`,
  ): Promise<Array<CounterfactualSafe>>;

  createCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe>;

  deleteCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
    chainId: string;
    predictedAddress: `0x${string}`;
  }): Promise<void>;

  deleteCounterfactualSafes(args: {
    authPayload: AuthPayload;
    address: `0x${string}`;
  }): Promise<void>;
}

@Module({
  imports: [AccountsRepositoryModule, CounterfactualSafesDatasourceModule],
  providers: [
    {
      provide: ICounterfactualSafesRepository,
      useClass: CounterfactualSafesRepository,
    },
  ],
  exports: [ICounterfactualSafesRepository],
})
export class CounterfactualSafesRepositoryModule {}
