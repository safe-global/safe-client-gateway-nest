import { newConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-confirmation.builder';
import type { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { NewConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-confirmation.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('NewConfirmationEventSchema', () => {
  it('should validate a new confirmation event', () => {
    const newConfirmationEvent = newConfirmationEventBuilder().build();

    const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow non-NEW_CONFIRMATION event', () => {
    const newConfirmationEvent = newConfirmationEventBuilder()
      .with(
        'type',
        faker.word.sample() as TransactionEventType.NEW_CONFIRMATION,
      )
      .build();

    const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: newConfirmationEvent.type,
          code: 'invalid_literal',
          expected: 'NEW_CONFIRMATION',
          path: ['type'],
          message: 'Invalid literal value, expected "NEW_CONFIRMATION"',
        },
      ]),
    );
  });

  it.each(['address' as const, 'owner' as const])(
    'should not allow a non-address %s',
    (field) => {
      const newConfirmationEvent = newConfirmationEventBuilder()
        .with(field, faker.string.alpha() as `0x${string}`)
        .build();

      const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid address',
            path: [field],
          },
        ]),
      );
    },
  );

  it.each(['address' as const, 'owner' as const])(
    'should checksum the  %s',
    (field) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const newConfirmationEvent = newConfirmationEventBuilder()
        .with(field, nonChecksummedAddress)
        .build();

      const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

      expect(result.success && result.data[field]).toStrictEqual(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each([
    'type' as const,
    'address' as const,
    'chainId' as const,
    'owner' as const,
    'safeTxHash' as const,
  ])(`should not allow a missing %s`, (field) => {
    const newConfirmationEvent = newConfirmationEventBuilder().build();
    delete newConfirmationEvent[field];

    const result = NewConfirmationEventSchema.safeParse(newConfirmationEvent);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === field,
    ).toBe(true);
  });
});
