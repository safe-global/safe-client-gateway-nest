import { JSONSchemaType } from 'ajv';
import { Event } from '@/routes/cache-hooks/entities/event.entity';

export const WEB_HOOK_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/web-hook.json';

export const webHookSchema: JSONSchemaType<Event> = {
  $id: WEB_HOOK_SCHEMA_ID,
  type: 'object',
  discriminator: { propertyName: 'type' },
  required: ['type', 'chainId'],
  oneOf: [
    {
      $ref: 'chain-update.json',
    },
    {
      $ref: 'deleted-multisig-transaction.json',
    },
    {
      $ref: 'executed-transaction.json',
    },
    {
      $ref: 'incoming-ether.json',
    },
    {
      $ref: 'incoming-token.json',
    },
    {
      $ref: 'message-created.json',
    },
    {
      $ref: 'module-transaction.json',
    },
    {
      $ref: 'new-confirmation.json',
    },
    {
      $ref: 'new-message-confirmation.json',
    },
    {
      $ref: 'outgoing-ether.json',
    },
    {
      $ref: 'outgoing-token.json',
    },
    {
      $ref: 'pending-transaction.json',
    },
    {
      $ref: 'safe-apps-update.json',
    },
  ],
};
