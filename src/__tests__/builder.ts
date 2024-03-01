export interface IBuilder<T> {
  with<K extends keyof T>(key: K, value: T[K]): this;

  build(): T;
}

export class Builder<T> implements IBuilder<T> {
  private target: Partial<T> = {};

  /**
   * Returns the {@link Builder} with the property {@link key} set to {@link value}.
   *
   * @param key - the name of the property from T to be set
   * @param value - the value of the property from T to be set
   */
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.target = { ...this.target, [key]: value };
    return this;
  }

  /**
   * Returns an instance of T with the values that were set so far
   */
  build(): T {
    return this.target as T;
  }
}
