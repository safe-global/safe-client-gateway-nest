import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';

export function addRecoveryModuleDtoBuilder(): IBuilder<AddRecoveryModuleDto> {
  return new Builder<AddRecoveryModuleDto>().with(
    'moduleAddress',
    faker.finance.ethereumAddress(),
  );
}
