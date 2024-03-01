import { toHex } from 'viem';
import { faker } from '@faker-js/faker';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { transactionAddedEventBuilder } from '@/domain/alerts/__tests__/delay-modifier.encoder';

describe('DelayModifierDecoder', () => {
  let target: DelayModifierDecoder;

  beforeEach(() => {
    jest.clearAllMocks();
    target = new DelayModifierDecoder();
  });

  it('decodes a TransactionAdded event correctly', () => {
    const transactionAddedEvent = transactionAddedEventBuilder();
    const { data, topics } = transactionAddedEvent.encode();

    expect(target.decodeEventLog({ data, topics })).toEqual({
      eventName: 'TransactionAdded',
      args: transactionAddedEvent.build(),
    });
  });

  it('throws if the event cannot be decoded', () => {
    const data = toHex(faker.string.hexadecimal({ length: 514 }));

    expect(() => target.decodeEventLog({ data, topics: [] })).toThrow();
  });
});
