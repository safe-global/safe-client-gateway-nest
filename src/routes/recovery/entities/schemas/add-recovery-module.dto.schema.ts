import { JSONSchemaType } from 'ajv';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';

export const ADD_RECOVERY_MODULE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/recovery/add-recovery-module.dto.json';

export const addRecoveryModuleDtoSchema: JSONSchemaType<AddRecoveryModuleDto> =
  {
    $id: ADD_RECOVERY_MODULE_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      moduleAddress: { type: 'string' },
    },
    required: ['moduleAddress'],
  };
