import { ZodError } from 'zod';
import { OctavGetPortfolioSchema } from '@/datasources/portfolio-api/entities/octav-get-portfolio.entity';
import type { OctavGetPortfolio } from '@/datasources/portfolio-api/entities/octav-get-portfolio.entity';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';

describe('OctavGetPortfolioSchema', () => {
  it('should validate a getPortfolio response', () => {
    const getPortfolio: OctavGetPortfolio = {
      getPortfolio: [portfolioBuilder().build()],
    };

    const result = OctavGetPortfolioSchema.safeParse(getPortfolio);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid getPortfolio response', () => {
    const getPortfolio = { invalid: 'getPortfolio' };

    const result = OctavGetPortfolioSchema.safeParse(getPortfolio);

    expect(result.success).toBe(false);
    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['getPortfolio'],
          message: 'Required',
        },
      ]),
    );
  });
});
