import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GetDelegateDto } from '@/routes/delegates/entities/get-delegate.dto.entity';
import {
  GET_DELEGATE_DTO_SCHEMA_ID,
  getDelegateDtoSchema,
} from '@/routes/delegates/entities/schemas/get-delegate.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class GetDelegateDtoValidationPipe
  implements PipeTransform<any, GetDelegateDto>
{
  private readonly isValid: ValidateFunction<GetDelegateDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      GET_DELEGATE_DTO_SCHEMA_ID,
      getDelegateDtoSchema,
    );
  }
  transform(data: any): GetDelegateDto {
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
