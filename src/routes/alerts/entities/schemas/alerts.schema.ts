import { JSONSchemaType } from 'ajv';
import {
  AlertLog,
  AlertTransaction,
  Alert,
  EventType,
} from '@/routes/alerts/entities/alert.dto.entity';

export const ALERT_LOGS_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/alerts/alert-logs.json';

export const alertLogsSchema: JSONSchemaType<Array<AlertLog>> = {
  $id: ALERT_LOGS_SCHEMA_ID,
  type: 'array',
  items: {
    type: 'object',
    properties: {
      address: { type: 'string' },
      topics: { type: 'array', items: { type: 'string' } },
      data: { type: 'string' },
    },
    required: ['address', 'topics', 'data'],
  },
};

export const ALERT_TRANSACTION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/alerts/alert-transaction.json';

export const alertTransactionSchema: JSONSchemaType<AlertTransaction> = {
  $id: ALERT_TRANSACTION_SCHEMA_ID,
  type: 'object',
  properties: {
    network: { type: 'string' },
    block_hash: { type: 'string' },
    block_number: { type: 'number' },
    hash: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    logs: { $ref: 'alert-logs.json' },
    input: { type: 'string' },
    value: { type: 'string' },
    nonce: { type: 'string' },
    gas: { type: 'string' },
    gas_used: { type: 'string' },
    cumulative_gas_used: { type: 'string' },
    gas_price: { type: 'string' },
    gas_tip_cap: { type: 'string' },
    gas_fee_cap: { type: 'string' },
  },
  required: [
    'network',
    'block_hash',
    'block_number',
    'hash',
    'from',
    'to',
    'logs',
    'input',
    'value',
    'nonce',
    'gas',
    'gas_used',
    'cumulative_gas_used',
    'gas_price',
    'gas_tip_cap',
    'gas_fee_cap',
  ],
};

export const ALERT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/alerts/alert.json';

export const alertSchema: JSONSchemaType<Alert> = {
  $id: ALERT_SCHEMA_ID,
  type: 'object',
  properties: {
    id: { type: 'string' },
    event_type: { type: 'string', enum: Object.values(EventType) },
    transaction: { $ref: 'alert-transaction.json' },
  },
  required: ['id', 'event_type', 'transaction'],
};
