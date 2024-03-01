import { Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import {
  ADD_RECOVERY_MODULE_DTO_SCHEMA_ID,
  addRecoveryModuleDtoSchema,
} from '@/routes/recovery/entities/schemas/add-recovery-module.dto.schema';

@Injectable()
export class AddRecoveryModuleDtoValidationPipe
  implements PipeTransform<any, AddRecoveryModuleDto>
{
  private readonly isValid: ValidateFunction<AddRecoveryModuleDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      ADD_RECOVERY_MODULE_DTO_SCHEMA_ID,
      addRecoveryModuleDtoSchema,
    );
  }
  transform(data: any): AddRecoveryModuleDto {
    return this.genericValidator.validate(this.isValid, data);
  }
}
