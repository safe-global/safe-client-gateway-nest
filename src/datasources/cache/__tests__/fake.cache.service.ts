import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export class FakeCacheService implements ICacheService {
  private cache: Record<string, Record<string, any>> = {};
  private isReady: boolean = true;

  ping(): Promise<unknown> {
    return this.isReady ? Promise.resolve() : Promise.reject();
  }

  setReadyState(isReady: boolean): void {
    this.isReady = isReady;
  }

  keyCount(): number {
    return Object.keys(this.cache).length;
  }

  clear(): void {
    this.cache = {};
  }

  async deleteByKey(key: string): Promise<number> {
    delete this.cache[key];
    await this.set(
      new CacheDir(`invalidationTimeMs:${key}`, ''),
      Date.now().toString(),
    );
    return Promise.resolve(1);
  }

  deleteByKeyPattern(pattern: string): Promise<void> {
    const patternRegex = RegExp(pattern.replace('*', '.*'));
    for (const key in this.cache) {
      if (patternRegex.test(key)) {
        delete this.cache[key];
      }
    }
    return Promise.resolve();
  }

  get(cacheDir: CacheDir): Promise<string | undefined> {
    const fields = this.cache[cacheDir.key];
    if (fields === undefined) return Promise.resolve(undefined);
    return Promise.resolve(this.cache[cacheDir.key][cacheDir.field]);
  }

  set(
    cacheDir: CacheDir,
    value: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expireTimeSeconds?: number,
  ): Promise<void> {
    const fields = this.cache[cacheDir.key];
    if (fields === undefined) {
      this.cache[cacheDir.key] = {};
    }
    this.cache[cacheDir.key][cacheDir.field] = value;
    return Promise.resolve();
  }
}
