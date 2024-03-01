import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import {
  CREATE_DELEGATE_DTO_SCHEMA_ID,
  createDelegateDtoSchema,
} from '@/routes/delegates/entities/schemas/create-delegate.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class CreateDelegateDtoValidationPipe
  implements PipeTransform<any, CreateDelegateDto>
{
  private readonly isValid: ValidateFunction<CreateDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      CREATE_DELEGATE_DTO_SCHEMA_ID,
      createDelegateDtoSchema,
    );
  }
  transform(data: any): CreateDelegateDto {
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
