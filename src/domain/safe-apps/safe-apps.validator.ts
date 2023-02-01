import { Injectable } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { IValidator } from '../interfaces/validator.interface';
import { GenericValidator } from '../schema/generic.validator';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SafeApp } from './entities/safe-app.entity';
import {
  safeAppAccessControlSchema,
  safeAppProviderSchema,
  safeAppSchema,
} from './entities/schemas/safe-app.schema';

@Injectable()
export class SafeAppsValidator implements IValidator<SafeApp> {
  private readonly isValidSafeApp: ValidateFunction<SafeApp>;

  constructor(
    private readonly genericValidator: GenericValidator,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe-apps/safe-app-provider.json',
      safeAppProviderSchema,
    );

    this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe-apps/safe-app-access-control.json',
      safeAppAccessControlSchema,
    );

    this.isValidSafeApp = this.jsonSchemaService.getSchema(
      'https://safe-client.safe.global/schemas/safe-apps/safe-app.json',
      safeAppSchema,
    );
  }

  validate(data: unknown): SafeApp {
    return this.genericValidator.validate(this.isValidSafeApp, data);
  }
}
