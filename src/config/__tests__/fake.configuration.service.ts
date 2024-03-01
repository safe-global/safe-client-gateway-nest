import { IConfigurationService } from '@/config/configuration.service.interface';

export class FakeConfigurationService implements IConfigurationService {
  private configuration: Record<string, any> = {};

  set(key: string, value: any): void {
    this.configuration[key] = value;
  }

  keyCount(): number {
    return Object.keys(this.configuration).length;
  }

  get<T>(key: string): T | undefined {
    return this.configuration[key] as T;
  }

  getOrThrow<T>(key: string): T {
    const value = this.configuration[key];
    if (value === undefined) {
      throw Error(`No value set for key ${key}`);
    }

    return value as T;
  }
}
