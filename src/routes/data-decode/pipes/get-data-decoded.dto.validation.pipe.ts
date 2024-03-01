import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GetDataDecodedDto } from '@/routes/data-decode/entities/get-data-decoded.dto.entity';
import {
  GET_DATA_DECODED_DTO_SCHEMA_ID,
  getDataDecodedDtoSchema,
} from '@/routes/data-decode/entities/schemas/get-data-decoded.dto.schema';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class GetDataDecodedDtoValidationPipe
  implements PipeTransform<any, GetDataDecodedDto>
{
  private readonly isValid: ValidateFunction<GetDataDecodedDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      GET_DATA_DECODED_DTO_SCHEMA_ID,
      getDataDecodedDtoSchema,
    );
  }
  transform(data: any): GetDataDecodedDto {
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
