import { DeletedMultisigTransaction } from '@/routes/cache-hooks/entities/deleted-multisig-transaction.entity';
import { EventType } from '@/routes/cache-hooks/entities/event-payload.entity';
import { JSONSchemaType } from 'ajv';

export const DELETED_MULTISIG_TRANSACTION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/deleted-multisig-transaction.json';

export const deletedMultisigTransactionEventSchema: JSONSchemaType<DeletedMultisigTransaction> =
  {
    $id: DELETED_MULTISIG_TRANSACTION_SCHEMA_ID,
    type: 'object',
    properties: {
      address: { type: 'string' },
      chainId: { type: 'string' },
      type: { type: 'string', const: EventType.DELETED_MULTISIG_TRANSACTION },
      safeTxHash: { type: 'string' },
    },
    required: ['address', 'chainId', 'type', 'safeTxHash'],
  };
