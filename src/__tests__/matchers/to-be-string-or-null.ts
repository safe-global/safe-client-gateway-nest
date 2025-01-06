import { expect } from '@jest/globals';
import type { MatcherFunction } from 'expect';

const anyStringOrNull: MatcherFunction = function (actual) {
  const pass = actual === null || typeof actual === 'string';
  if (pass) {
    return {
      message: () => `expected ${actual} to be string or null`,
      pass: true,
    };
  } else {
    return {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      message: () => `expected ${actual} to be string or null`,
      pass: false,
    };
  }
};

expect.extend({
  anyStringOrNull,
});

declare module 'expect' {
  interface AsymmetricMatchers {
    anyStringOrNull(): void;
  }

  interface Matchers<R> {
    anyStringOrNull(): R;
  }
}
