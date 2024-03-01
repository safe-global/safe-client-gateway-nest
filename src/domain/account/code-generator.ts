import * as crypto from 'crypto';

/**
 * Generates a random number up to six digits
 */
export default function (): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % 1_000_000;
}
