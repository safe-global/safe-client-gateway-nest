import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/alerts/__tests__/safe-transactions.encoder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/alerts/__tests__/multi-send-transactions.encoder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';

describe('MultiSendDecoder', () => {
  let mapper: MultiSendDecoder;

  beforeEach(() => {
    mapper = new MultiSendDecoder();
  });

  describe('mapMultiSendTransactions', () => {
    it('maps multiSend transactions correctly', () => {
      const safe = safeBuilder().build();
      const transactions = [
        addOwnerWithThresholdEncoder().encode(),
        removeOwnerEncoder(safe.owners).encode(),
        swapOwnerEncoder(safe.owners).encode(),
        changeThresholdEncoder().encode(),
      ].map((data) => ({
        operation: faker.number.int({ min: 0, max: 1 }),
        data,
        // Normally static (0/0) but more robust if we generate random values
        to: getAddress(safe.address),
        value: faker.number.bigInt(),
      }));

      const encodedTransactions = multiSendTransactionsEncoder(transactions);

      const data = multiSendEncoder()
        .with('transactions', encodedTransactions)
        .encode();

      expect(mapper.mapMultiSendTransactions(data)).toStrictEqual(transactions);
    });
  });
});
