import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import {
  GET_ESTIMATION_DTO_SCHEMA_ID,
  getEstimationDtoSchema,
} from '@/routes/estimations/entities/schemas/get-estimation.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class GetEstimationDtoValidationPipe
  implements PipeTransform<any, GetEstimationDto>
{
  private readonly isValid: ValidateFunction<GetEstimationDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      GET_ESTIMATION_DTO_SCHEMA_ID,
      getEstimationDtoSchema,
    );
  }
  transform(data: any): GetEstimationDto {
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
