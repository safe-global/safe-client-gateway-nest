import type { PipeTransform } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { ZodIssue, ZodSchema, z } from 'zod';
import { ZodError } from 'zod';

export class ZodErrorWithCode extends ZodError {
  constructor(
    public issues: Array<ZodIssue>,
    public code: number,
  ) {
    super(issues);
  }
}

export class ValidationPipe<T extends ZodSchema> implements PipeTransform {
  constructor(
    private schema: T,
    private code = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new ZodErrorWithCode(result.error.issues, this.code);
  }
}
