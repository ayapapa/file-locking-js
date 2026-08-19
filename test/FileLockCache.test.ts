import { describe, expect, it, vi, type Mock } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { Config, FileLock } from '../src/index';

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const logger = new PrettyConsole({ level: 'trace' });

FileLock.setConfig({ logger });

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
    expect((FileLock as any).cache.size > 0).toBe(true);  
    FileLock.clearCache();
    expect((FileLock as any).cache.size).toBe(0);  
  });

  async function testCacheStatus(config: Config, checkStatus: () => Promise<void>): Promise<void> {
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
    //expect((FileLock as any).cache.size).toBe(1);
    FileLock.setConfig(orgConf);
  }

  it("When the cache is cleared and locked, the number of cache entries becomes 1.", async () => {
    await testCacheStatus({ cache: true }, async () => expect((FileLock as any).cache.size).toBe(1));
   });

  it("If the cache is reset, then disabled, and subsequently locked, the cache does not exist.", async () => {
    await testCacheStatus({ cache: false }, async () => expect((FileLock as any).cache).toBeNull());
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
        expect((FileLock as any).cache.size).toBe(1);
      }
    );
  });

});
