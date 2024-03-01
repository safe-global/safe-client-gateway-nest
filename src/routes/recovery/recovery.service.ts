import { Inject, Injectable } from '@nestjs/common';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertsRepository } from '@/domain/alerts/alerts.repository';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';

@Injectable()
export class RecoveryService {
  constructor(
    @Inject(IAlertsRepository)
    private readonly alertsRepository: AlertsRepository,
  ) {}

  async addRecoveryModule(args: {
    chainId: string;
    safeAddress: string;
    addRecoveryModuleDto: AddRecoveryModuleDto;
  }): Promise<void> {
    const contract: AlertsRegistration = {
      chainId: args.chainId,
      address: args.addRecoveryModuleDto.moduleAddress,
      displayName: `${args.chainId}:${args.safeAddress}:${args.addRecoveryModuleDto.moduleAddress}`,
    };
    await this.alertsRepository.addContracts([contract]);
  }
}
