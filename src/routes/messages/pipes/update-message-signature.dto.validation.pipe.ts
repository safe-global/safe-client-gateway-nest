import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import {
  UPDATE_MESSAGE_SIGNATURE_DTO_SCHEMA_ID,
  updateMessageSignatureDtoSchema,
} from '@/routes/messages/entities/schemas/update-message-signature.dto.schema';
import { UpdateMessageSignatureDto } from '@/routes/messages/entities/update-message-signature.entity';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';

@Injectable()
export class UpdateMessageSignatureDtoValidationPipe
  implements PipeTransform<any, UpdateMessageSignatureDto>
{
  private readonly isValid: ValidateFunction<UpdateMessageSignatureDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      UPDATE_MESSAGE_SIGNATURE_DTO_SCHEMA_ID,
      updateMessageSignatureDtoSchema,
    );
  }

  transform(data: any): UpdateMessageSignatureDto {
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
