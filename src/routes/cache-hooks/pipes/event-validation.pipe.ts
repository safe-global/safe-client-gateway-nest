import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ValidateFunction } from 'ajv';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { Event } from '@/routes/cache-hooks/entities/event.entity';
import {
  EXECUTED_TRANSACTION_EVENT_SCHEMA_ID,
  executedTransactionEventSchema,
} from '@/routes/cache-hooks/entities/schemas/executed-transaction.schema';
import {
  NEW_CONFIRMATION_EVENT_SCHEMA_ID,
  newConfirmationEventSchema,
} from '@/routes/cache-hooks/entities/schemas/new-confirmation.schema';
import {
  PENDING_TRANSACTION_EVENT_SCHEMA_ID,
  pendingTransactionEventSchema,
} from '@/routes/cache-hooks/entities/schemas/pending-transaction.schema';
import {
  WEB_HOOK_SCHEMA_ID,
  webHookSchema,
} from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import {
  INCOMING_ETHER_EVENT_SCHEMA_ID,
  incomingEtherEventSchema,
} from '@/routes/cache-hooks/entities/schemas/incoming-ether.schema';
import {
  INCOMING_TOKEN_EVENT_SCHEMA_ID,
  incomingTokenEventSchema,
} from '@/routes/cache-hooks/entities/schemas/incoming-token.schema';
import {
  OUTGOING_ETHER_EVENT_SCHEMA_ID,
  outgoingEtherEventSchema,
} from '@/routes/cache-hooks/entities/schemas/outgoing-ether.schema';
import {
  OUTGOING_TOKEN_EVENT_SCHEMA_ID,
  outgoingTokenEventSchema,
} from '@/routes/cache-hooks/entities/schemas/outgoing-token.schema';
import {
  MODULE_TRANSACTION_EVENT_SCHEMA_ID,
  moduleTransactionEventSchema,
} from '@/routes/cache-hooks/entities/schemas/module-transaction.schema';
import {
  MESSAGE_CREATED_EVENT_SCHEMA_ID,
  messageCreatedEventSchema,
} from '@/routes/cache-hooks/entities/schemas/message-created.schema';
import {
  CHAIN_UPDATE_EVENT_SCHEMA_ID,
  chainUpdateEventSchema,
} from '@/routes/cache-hooks/entities/schemas/chain-update.schema';
import {
  SAFE_APPS_UPDATE_EVENT_SCHEMA_ID,
  safeAppsUpdateEventSchema,
} from '@/routes/cache-hooks/entities/schemas/safe-apps-update.schema';
import {
  NEW_MESSAGE_CONFIRMATION_EVENT_SCHEMA_ID,
  newMessageConfirmationEventSchema,
} from '@/routes/cache-hooks/entities/schemas/new-message-confirmation.schema';
import {
  DELETED_MULTISIG_TRANSACTION_SCHEMA_ID,
  deletedMultisigTransactionEventSchema,
} from '@/routes/cache-hooks/entities/schemas/deleted-multisig-transaction.schema';

@Injectable()
export class EventValidationPipe implements PipeTransform<Event> {
  private readonly isWebHookEvent: ValidateFunction<Event>;

  constructor(private readonly jsonSchemaService: JsonSchemaService) {
    this.jsonSchemaService.getSchema(
      CHAIN_UPDATE_EVENT_SCHEMA_ID,
      chainUpdateEventSchema,
    );
    this.jsonSchemaService.getSchema(
      DELETED_MULTISIG_TRANSACTION_SCHEMA_ID,
      deletedMultisigTransactionEventSchema,
    );
    this.jsonSchemaService.getSchema(
      EXECUTED_TRANSACTION_EVENT_SCHEMA_ID,
      executedTransactionEventSchema,
    );
    this.jsonSchemaService.getSchema(
      INCOMING_ETHER_EVENT_SCHEMA_ID,
      incomingEtherEventSchema,
    );
    this.jsonSchemaService.getSchema(
      INCOMING_TOKEN_EVENT_SCHEMA_ID,
      incomingTokenEventSchema,
    );
    this.jsonSchemaService.getSchema(
      MESSAGE_CREATED_EVENT_SCHEMA_ID,
      messageCreatedEventSchema,
    );
    this.jsonSchemaService.getSchema(
      MODULE_TRANSACTION_EVENT_SCHEMA_ID,
      moduleTransactionEventSchema,
    );
    this.jsonSchemaService.getSchema(
      NEW_CONFIRMATION_EVENT_SCHEMA_ID,
      newConfirmationEventSchema,
    );
    this.jsonSchemaService.getSchema(
      NEW_MESSAGE_CONFIRMATION_EVENT_SCHEMA_ID,
      newMessageConfirmationEventSchema,
    );
    this.jsonSchemaService.getSchema(
      OUTGOING_ETHER_EVENT_SCHEMA_ID,
      outgoingEtherEventSchema,
    );
    this.jsonSchemaService.getSchema(
      OUTGOING_TOKEN_EVENT_SCHEMA_ID,
      outgoingTokenEventSchema,
    );
    this.jsonSchemaService.getSchema(
      PENDING_TRANSACTION_EVENT_SCHEMA_ID,
      pendingTransactionEventSchema,
    );
    this.jsonSchemaService.getSchema(
      SAFE_APPS_UPDATE_EVENT_SCHEMA_ID,
      safeAppsUpdateEventSchema,
    );
    this.isWebHookEvent = this.jsonSchemaService.getSchema(
      WEB_HOOK_SCHEMA_ID,
      webHookSchema,
    );
  }

  transform(value: any): Event {
    if (this.isWebHookEvent(value)) {
      return value;
    }
    throw new BadRequestException('Validation failed');
  }
}
