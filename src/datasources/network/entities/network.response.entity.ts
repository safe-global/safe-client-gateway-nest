import type { Raw } from '@/validation/entities/raw.entity';

export interface NetworkResponse<T> {
  data: Raw<T>;
  status: number;
}
