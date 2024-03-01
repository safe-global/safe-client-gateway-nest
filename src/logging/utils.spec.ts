import { asError } from '@/logging/utils';

describe('asError', () => {
  it('should return the same error if thrown is an instance of Error', () => {
    const thrown = new Error('test error');

    expect(asError(thrown)).toEqual(new Error('test error'));
  });

  it('should return the same error if thrown is a superset of Error', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
      }
    }
    const thrown = new CustomError('test error');

    expect(asError(thrown)).toEqual(new CustomError('test error'));
  });

  it('should return a new Error instance with the thrown value if thrown is a string', () => {
    const thrown = 'test error';

    const result = asError(thrown);
    expect(result).toEqual(new Error('test error'));
  });

  it('should return a new Error instance with the message thrown value if thrown is object with message', () => {
    const thrown = { message: 'test error' };

    const result = asError(thrown);
    expect(result).toEqual(new Error('test error'));
  });

  it('should return a new Error instance with the stringified thrown value if thrown is not an instance of Error', () => {
    const thrown = { notMessage: 'test error' };

    expect(asError(thrown)).toEqual(new Error('{"notMessage":"test error"}'));
  });

  it('should return a new Error instance with the string representation of thrown if JSON.stringify throws an error', () => {
    // Circular dependency
    const thrown: Record<string, unknown> = {};
    thrown.a = { b: thrown };

    expect(asError(thrown)).toEqual(new Error('[object Object]'));
  });
});
