import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileLockConfig, FileLock } from '../src/index.ts';
import { logger, sleepAsync, TestLock } from './FileLockTestCommon.ts'

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('FileLock', () => {

  it("After clearing the cache, the number of cache entries is 0.", async () => {
    const retVal = "test_005", key = retVal;
    try {
    const ret = await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal;
      },
      {}
    );
    }
    catch (err) {
      logger.error(err);
    }
    expect(TestLock.getCacheSize() > 0).toBe(true);  
    FileLock.clearCache();
    expect(TestLock.getCacheSize()).toBe(0);  
  });

  async function testCacheStatus(config: FileLockConfig, checkStatus: () => Promise<void>): Promise<void> {
    FileLock.clearCache();
    const orgConf = FileLock.getConfig();
    FileLock.setConfig({ ...config, logger });
    const retVal = "test_001", key = retVal;
    expect(
      await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal;
      }
    )).toBe(retVal);
    await checkStatus();
    //expect(TestLock.getCacheSize()).toBe(1);
    FileLock.setConfig(orgConf);
  }

  it("When the cache is cleared and locked, the number of cache entries becomes 1.", async () => {
    // ****　まだ、未確定  **** There should be two instances: the lock instance and the historical lock instance.
    await testCacheStatus({ cache: true }, async () => expect(TestLock.getCacheSize()).toBe(1/*2*/));
   });

  it("If the cache is reset, then disabled, and subsequently locked, the cache does not exist.", async () => {
    await testCacheStatus({ cache: false }, async () => expect(TestLock.getCache()).toBeNull());
  });

  it("When the maximum cache size is set to 1, even after locking twice with different keys, " +
    "the number of cache entries remains 1, and the cache for the second key persists.", async () => {
    const retVal = "test_001";
    await testCacheStatus(
      { cache: true, cacheMaxNum: 1  }, 
      async () => {
        const key2 = 'test_002';
        expect(
          await FileLock.withLock(key2, 
          async () => {
            await sleepAsync(500);
            return retVal;
          }
        )).toBe(retVal);
        expect(TestLock.getCacheSize()).toBe(1);
      }
    );
  });

});
