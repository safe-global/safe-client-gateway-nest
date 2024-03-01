import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';
import {
  DELETE_SAFE_DELEGATE_DTO_SCHEMA_ID,
  deleteSafeDelegateDtoSchema,
} from '@/routes/delegates/entities/schemas/delete-safe-delegate.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class DeleteSafeDelegateDtoValidationPipe
  implements PipeTransform<any, DeleteSafeDelegateDto>
{
  private readonly isValid: ValidateFunction<DeleteSafeDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      DELETE_SAFE_DELEGATE_DTO_SCHEMA_ID,
      deleteSafeDelegateDtoSchema,
    );
  }
  transform(data: any): DeleteSafeDelegateDto {
    try {
      return this.genericValidator.validate(this.isValid, data);
    } catch (err) {
      if (err instanceof HttpException) {
        throw new HttpException(err.getResponse(), HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }
}
