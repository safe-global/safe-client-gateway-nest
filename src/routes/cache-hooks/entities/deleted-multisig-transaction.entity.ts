import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface DeletedMultisigTransaction
  extends EventPayload<EventType.DELETED_MULTISIG_TRANSACTION> {
  safeTxHash: string;
}
