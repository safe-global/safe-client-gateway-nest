import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  buildLenientPageSchema,
  buildPageSchema,
} from '@/domain/entities/schemas/page.schema.factory';
import { faker } from '@faker-js/faker';
import { z } from 'zod';

describe('Page schema factory', () => {
  describe('buildPageSchema', () => {
    it('should build a page schema', () => {
      const results = faker.helpers.multiple(() => faker.lorem.word(), {
        count: { min: 1, max: 5 },
      });
      const page = pageBuilder()
        .with('results', results)
        .with('count', results.length)
        .build();
      const Schema = buildPageSchema(z.string());

      const result = Schema.safeParse(page);

      expect(result.success).toBe(true);
    });

    it('should expect a numerical count', () => {
      const results = faker.helpers.multiple(() => faker.lorem.word(), {
        count: { min: 1, max: 5 },
      });
      const page = pageBuilder()
        .with('results', results)
        .with('count', results.length.toString() as unknown as number)
        .build();
      const Schema = buildPageSchema(z.string());

      const result = Schema.safeParse(page);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['count'],
        received: 'string',
      });
    });

    it.each(['next' as const, 'previous' as const])(
      'should expect a string %s',
      (key) => {
        const results = faker.helpers.multiple(() => faker.lorem.word(), {
          count: { min: 1, max: 5 },
        });
        const page = pageBuilder()
          .with('results', results)
          .with('count', results.length)
          .with(key, faker.number.int() as unknown as string)
          .build();
        const Schema = buildPageSchema(z.string());

        const result = Schema.safeParse(page);

        expect(!result.success && result.error.issues.length).toBe(1);
        expect(!result.success && result.error.issues[0]).toStrictEqual({
          code: 'invalid_type',
          expected: 'string',
          message: 'Expected string, received number',
          path: [key],
          received: 'number',
        });
      },
    );

    it.each(['count' as const, 'next' as const, 'previous' as const])(
      'should allow a nullable %s',
      (key) => {
        const results = faker.helpers.multiple(() => faker.lorem.word(), {
          count: { min: 1, max: 5 },
        });
        const page = pageBuilder()
          .with('results', results)
          .with('count', results.length)
          .with(key, null)
          .build();
        const Schema = buildPageSchema(z.string());

        const result = Schema.safeParse(page);

        expect(result.success);
      },
    );
  });

  describe('buildLenientPageSchema', () => {
    it('should build a lenient page schema', () => {
      const results = faker.helpers.multiple(() => faker.lorem.word(), {
        count: { min: 1, max: 5 },
      });
      const page = pageBuilder()
        .with('results', results)
        .with('count', results.length)
        .build();
      const Schema = buildLenientPageSchema(z.string());

      const result = Schema.safeParse(page);

      expect(result.success).toBe(true);
    });

    it('should expect a numerical count', () => {
      const results = faker.helpers.multiple(() => faker.lorem.word(), {
        count: { min: 1, max: 5 },
      });
      const page = pageBuilder()
        .with('results', results)
        .with('count', results.length.toString() as unknown as number)
        .build();
      const Schema = buildLenientPageSchema(z.string());

      const result = Schema.safeParse(page);

      expect(!result.success && result.error.issues.length).toBe(1);
      expect(!result.success && result.error.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: ['count'],
        received: 'string',
      });
    });

    it.each(['next' as const, 'previous' as const])(
      'should expect a string %s',
      (key) => {
        const results = faker.helpers.multiple(() => faker.lorem.word(), {
          count: { min: 1, max: 5 },
        });
        const page = pageBuilder()
          .with('results', results)
          .with('count', results.length)
          .with(key, faker.number.int() as unknown as string)
          .build();
        const Schema = buildLenientPageSchema(z.string());

        const result = Schema.safeParse(page);

        expect(!result.success && result.error.issues.length).toBe(1);
        expect(!result.success && result.error.issues[0]).toStrictEqual({
          code: 'invalid_type',
          expected: 'string',
          message: 'Expected string, received number',
          path: [key],
          received: 'number',
        });
      },
    );

    it.each(['count' as const, 'next' as const, 'previous' as const])(
      'should allow a nullable %s',
      (key) => {
        const results = faker.helpers.multiple(() => faker.lorem.word(), {
          count: { min: 1, max: 5 },
        });
        const page = pageBuilder()
          .with('results', results)
          .with('count', results.length)
          .with(key, null)
          .build();
        const Schema = buildLenientPageSchema(z.string());

        const result = Schema.safeParse(page);

        expect(result.success);
      },
    );

    it('should remove invalid items from results', () => {
      const results = faker.helpers.multiple(
        () => ({ test: faker.lorem.word() }),
        { count: { min: 2, max: 5 } },
      );
      const page = pageBuilder<{ test: string }>()
        .with('results', structuredClone(results))
        .with('count', results.length)
        .build();
      page.results[0].test = faker.number.int() as unknown as string;
      const Schema = buildLenientPageSchema(
        z.object({
          test: z.string(),
        }),
      );

      const result = Schema.safeParse(page);

      expect(result.success && result.data.results).toStrictEqual(
        results.slice(1),
      );
    });
  });
});
