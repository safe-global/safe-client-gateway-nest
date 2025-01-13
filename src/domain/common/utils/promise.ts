import { HttpException, HttpStatus } from '@nestjs/common';

export const promiseWithTimeout = async <T>(
  promise: Promise<T>,
  timeout: number,
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;

  return Promise.race<T>([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new PromiseTimeoutError(
              'Promise timed out!',
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          ),
        timeout,
      );
    }),
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export class PromiseTimeoutError extends HttpException {
  //
  public constructor(
    message: string,
    statusCode: number = HttpStatus.SERVICE_UNAVAILABLE,
  ) {
    super(message, statusCode);
  }
}
