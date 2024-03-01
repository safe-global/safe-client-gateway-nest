import {
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { GenericValidator } from '@/validation/providers/generic.validator';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';
import {
  DELETE_TRANSACTION_DTO_SCHEMA_ID,
  deleteTransactionDtoSchema,
} from '@/routes/transactions/entities/schemas/delete-transaction.dto.schema';

@Injectable()
export class DeleteTransactionDtoValidationPipe
  implements PipeTransform<unknown, DeleteTransactionDto>
{
  private readonly isValid: ValidateFunction<DeleteTransactionDto>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.isValid = this.jsonSchemaService.getSchema(
      DELETE_TRANSACTION_DTO_SCHEMA_ID,
      deleteTransactionDtoSchema,
    );
  }

  transform(data: unknown): DeleteTransactionDto {
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
