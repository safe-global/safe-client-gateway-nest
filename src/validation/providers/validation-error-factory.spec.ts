import { DefinedError } from 'ajv';
import { faker } from '@faker-js/faker';
import { ValidationErrorFactory } from '@/validation/providers/validation-error-factory';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

describe('ValidationErrorFactory', () => {
  const validationErrorFactory = new ValidationErrorFactory(mockLoggingService);

  it('should create an HttpException from an array of errors', async () => {
    const errors: DefinedError[] = [
      {
        instancePath: faker.word.sample(),
        schemaPath: faker.word.sample(),
        keyword: 'additionalProperties',
        params: { additionalProperty: faker.word.sample() },
        message: faker.word.sample(),
      },
    ];

    const err = validationErrorFactory.from(errors);

    expect(err.message).toBe('Validation failed');
    expect(err.getStatus()).toBe(500);
    const response = err.getResponse();

    if (
      typeof response === 'string' ||
      !('code' in response) ||
      !('message' in response) ||
      !('arguments' in response)
    ) {
      fail('Malformed response');
    }

    expect(response.code).toBe(42);
    expect(response.message).toBe('Validation failed');
    expect(response.arguments).toEqual([]);
  });
});
