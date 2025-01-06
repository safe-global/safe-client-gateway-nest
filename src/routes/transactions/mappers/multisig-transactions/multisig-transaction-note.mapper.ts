import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';

@Injectable()
export class MultisigTransactionNoteMapper {
  mapTxNote(transaction: MultisigTransaction): string | null {
    if (transaction.origin) {
      try {
        const origin = JSON.parse(transaction.origin);
        if (typeof origin.note === 'string') {
          return origin.note;
        }
      } catch {
        // Ignore, no note
      }
    }
    return null;
  }
}
