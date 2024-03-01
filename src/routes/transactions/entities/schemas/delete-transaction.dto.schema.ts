import { JSONSchemaType } from 'ajv';
import { DeleteTransactionDto } from '@/routes/transactions/entities/delete-transaction.dto.entity';

export const DELETE_TRANSACTION_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/transactions/delete-transaction.dto.json';

export const deleteTransactionDtoSchema: JSONSchemaType<DeleteTransactionDto> =
  {
    $id: DELETE_TRANSACTION_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      signature: { type: 'string' },
    },
    required: ['signature'],
  };
