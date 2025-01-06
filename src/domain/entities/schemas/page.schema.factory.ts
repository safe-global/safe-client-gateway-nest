import { z } from 'zod';
import type { Page } from '@/domain/entities/page.entity';

const BasePageSchema = z.object({
  count: z.number().nullable(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
});

export function buildPageSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<Page<z.infer<T>>> {
  return BasePageSchema.extend({ results: z.array(itemSchema) });
}

export const LenientBasePageSchema = BasePageSchema.extend({
  results: z.array(z.any()),
});

/**
 * Builds a lenient page schema that filters out invalid items from
 * the results array, setting the length of which as the count.
 */
export function buildLenientPageSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<Page<z.infer<T>>> {
  return LenientBasePageSchema.transform((data) => {
    const results = data.results.flatMap((item) => {
      const result = itemSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });

    // Note: @TODO The `results` object includes a `count` property, which the client is not currently using.
    // We validate the chains and subtract the invalid ones from the count.
    // However, due to pagination, we can only validate the chains on the current page,
    // meaning the count may still include invalid chains from subsequent pages.
    // For now, it's acceptable to ignore these inaccuracies in the count.
    // That said, we should address this issue in the future to ensure the count is fully accurate.
    return {
      ...data,
      results,
    };
  });
}
