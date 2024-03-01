import { faker } from '@faker-js/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

describe('FakeCacheService', () => {
  let target: FakeCacheService;

  beforeEach(async () => {
    target = new FakeCacheService();
  });

  it('sets key', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
    );
    const value = faker.string.alphanumeric();

    await target.set(cacheDir, value, 0);

    await expect(target.get(cacheDir)).resolves.toBe(value);
    expect(target.keyCount()).toBe(1);
  });

  it('deletes key and sets invalidationTimeMs', async () => {
    jest.useFakeTimers();
    const now = jest.now();
    const key = faker.string.alphanumeric();
    const field = faker.string.alphanumeric();
    const cacheDir = new CacheDir(key, field);
    const value = faker.string.alphanumeric();

    await target.set(cacheDir, value, 0);
    await target.deleteByKey(key);

    await expect(target.get(cacheDir)).resolves.toBe(undefined);
    await expect(
      target.get(new CacheDir(`invalidationTimeMs:${cacheDir.key}`, '')),
    ).resolves.toBe(now.toString());
    expect(target.keyCount()).toBe(1);
    jest.useRealTimers();
  });

  it('clears keys', async () => {
    const actions: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      actions.push(
        target.set(new CacheDir(`key${i}`, `field${i}`), `value${i}`, 0),
      );
    }

    await Promise.all(actions);
    target.clear();

    expect(target.keyCount()).toBe(0);
  });

  it('deletes keys by pattern', async () => {
    const prefix = faker.word.sample();
    // insert 5 items matching the pattern
    await Promise.all(
      faker.helpers.multiple(
        () =>
          target.set(new CacheDir(`${prefix}${faker.string.uuid()}`, ''), ''),
        { count: 5 },
      ),
    );
    // insert 4 items not matching the pattern
    await Promise.all(
      faker.helpers.multiple(
        () => target.set(new CacheDir(`${faker.string.uuid()}`, ''), ''),
        { count: 4 },
      ),
    );

    await target.deleteByKeyPattern(`${prefix}*`);

    expect(target.keyCount()).toBe(4);
  });

  it('deletes keys by pattern (2)', async () => {
    const prefix = faker.word.sample();
    const suffix = faker.word.sample();
    // insert 5 items matching the pattern
    await Promise.all(
      faker.helpers.multiple(
        () =>
          target.set(
            new CacheDir(`${prefix}_${faker.string.uuid()}_${suffix}`, ''),
            '',
          ),
        { count: 5 },
      ),
    );
    // insert 4 items not matching the pattern
    await Promise.all(
      faker.helpers.multiple(
        () => target.set(new CacheDir(`${faker.string.uuid()}`, ''), ''),
        { count: 4 },
      ),
    );

    await target.deleteByKeyPattern(`${prefix}_*_${suffix}`);

    expect(target.keyCount()).toBe(4);
  });
});
