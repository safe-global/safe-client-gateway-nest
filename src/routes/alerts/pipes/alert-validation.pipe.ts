import { ValidateFunction } from 'ajv';
import {
  Injectable,
  PipeTransform,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Alert } from '@/routes/alerts/entities/alert.dto.entity';
import {
  ALERT_LOGS_SCHEMA_ID,
  ALERT_SCHEMA_ID,
  ALERT_TRANSACTION_SCHEMA_ID,
  alertLogsSchema,
  alertSchema,
  alertTransactionSchema,
} from '@/routes/alerts/entities/schemas/alerts.schema';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { GenericValidator } from '@/validation/providers/generic.validator';

@Injectable()
export class AlertValidationPipe implements PipeTransform<Alert> {
  private readonly isValid: ValidateFunction<Alert>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    jsonSchemaService.getSchema(ALERT_LOGS_SCHEMA_ID, alertLogsSchema);

    jsonSchemaService.getSchema(
      ALERT_TRANSACTION_SCHEMA_ID,
      alertTransactionSchema,
    );

    this.isValid = jsonSchemaService.getSchema(ALERT_SCHEMA_ID, alertSchema);
  }

  transform(data: unknown): Alert {
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
