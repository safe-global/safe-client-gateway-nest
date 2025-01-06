import { faker } from '@faker-js/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
describe('FakeCacheService', () => {
  let target: FakeCacheService;

  beforeEach(() => {
    target = new FakeCacheService();
  });

  it('sets key', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
    );
    const value = faker.string.alphanumeric();

    await target.hSet(cacheDir, value, faker.number.int({ min: 1 }));

    await expect(target.hGet(cacheDir)).resolves.toBe(value);
    expect(target.keyCount()).toBe(1);
  });

  it('deletes key and sets invalidationTimeMs', async () => {
    jest.useFakeTimers();
    const now = jest.now();
    const key = faker.string.alphanumeric();
    const field = faker.string.alphanumeric();
    const cacheDir = new CacheDir(key, field);
    const value = faker.string.alphanumeric();

    await target.hSet(cacheDir, value, faker.number.int({ min: 1 }));
    await target.deleteByKey(key);

    await expect(target.hGet(cacheDir)).resolves.toBe(undefined);
    await expect(
      target.hGet(new CacheDir(`invalidationTimeMs:${cacheDir.key}`, '')),
    ).resolves.toBe(now.toString());
    expect(target.keyCount()).toBe(1);
    jest.useRealTimers();
  });

  it('clears keys', async () => {
    const actions: Array<Promise<void>> = [];
    for (let i = 0; i < 5; i++) {
      actions.push(
        target.hSet(
          new CacheDir(`key${i}`, `field${i}`),
          `value${i}`,
          faker.number.int({ min: 1 }),
        ),
      );
    }

    await Promise.all(actions);
    target.clear();

    expect(target.keyCount()).toBe(0);
  });

  it('creates a missing key and increments its value', async () => {
    const key = faker.string.alphanumeric();
    const firstResult = await target.increment(key, undefined);
    expect(firstResult).toEqual(1);

    const results: Array<number> = [];
    for (let i = 0; i < 5; i++) {
      results.push(await target.increment(key, undefined));
    }

    expect(results).toEqual([2, 3, 4, 5, 6]);
  });

  it('increments the value of an existing key', async () => {
    const key = faker.string.alphanumeric();
    const initialValue = faker.number.int({ min: 100 });
    await target.hSet(
      new CacheDir(key, ''),
      initialValue,
      faker.number.int({ min: 1 }),
    );

    for (let i = 1; i <= 5; i++) {
      const result = await target.increment(key, undefined);
      expect(result).toEqual(initialValue + i);
    }
  });

  it('sets and gets the value of a counter key', async () => {
    const key = faker.string.alphanumeric();
    const value = faker.number.int({ min: 100 });
    await target.setCounter(key, value, undefined);

    await expect(target.getCounter(key)).resolves.toBe(value);
  });

  it('sets, increments and gets the value of a counter key', async () => {
    const key = faker.string.alphanumeric();
    const value = faker.number.int({ min: 100 });
    await target.setCounter(key, value, undefined);

    await target.increment(key, undefined);
    await target.increment(key, undefined);
    await target.increment(key, undefined);

    await expect(target.getCounter(key)).resolves.toBe(value + 3);
  });
});
