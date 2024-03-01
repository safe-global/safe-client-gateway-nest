/**
 * The {@link CacheKeyPrefix} is meant to be used whenever a prefix should be added to the keys
 * registered in the cache.
 *
 * This is useful in scenarios like:
 * - Multiple instances of the service can use the same Redis instance and use the prefix as a "data partition"
 * - Testing scenario where tests run concurrently – concurrent runs might affect the state of other tests given
 * that a cache instance might be shared between the tests.
 */
export const CacheKeyPrefix = Symbol('CacheKeyPrefix');
