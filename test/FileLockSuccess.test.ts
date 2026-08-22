import { describe, expect, it } from 'vitest';
import { logger, sleepAsync  } from './FileLockTestCommon.ts';
import { FileLock, FileLockUserOptions } from '../src/index';

describe('FileLock', () => {

  it("The lock is successfully acquired, and the return value of the callback is obtained.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {timeoutSec : 1 } as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
  });

  it("The process completes without interference between the two locks using different keys.", async () => {
    const key1 = 'testKey1', retVal1 = key1;
    const a =  FileLock.withLock("testKey1", 
      async () => {
        await sleepAsync(3000);
        return retVal1;
      },
      {timeoutSec : 1 }
    );
    
    const key2 = 'testKey2', retVal2 = key2;
    const b =  FileLock.withLock("testKey2", 
      async () => {
        await sleepAsync(3000);
        return retVal2;
      },
      {timeoutSec : 1 }
    );
    let res;
    expect(res = await Promise.all([a, b])).toHaveLength(2);
    expect(res[0]).toBe(retVal1);
    expect(res[1]).toBe(retVal2);
  });

  it("If reentrant locking is enabled, calling `withLock` with the same key from within " +
    "a callback function while the lock is already held will complete successfully.", async () => {

    const key = "testKey", retVal = "Reentrant-lock is enabled.";
    expect (await FileLock.withLock(key, 
      async (monitor) => {
        return await FileLock.withLock(
          key, 
          async (monitor2) => {
            // モニターは、同キー再入ロック時には共有される
            expect(monitor2).toBe(monitor);
            await sleepAsync(500)
            return retVal;
          },
          { allowReentry: true }
        );
      }
    )).toBe(retVal);
  });

  it("With three-level lock nesting, if `options.allowReentry` is set to `true`, " +
    "the operation completes successfully even if the first and third locks target the same key.", async () => {
 
    const key1 = "testKey_10000", key2 = 'testKey_20000';
    const ret = "OK";
    const options: FileLockUserOptions = { allowReentry: true }
    expect(await FileLock.withLock(key1, async (monitor1) => {
      return await FileLock.withLock(key2, async (monitor2) => {
        return await FileLock.withLock(
          key1, 
          async (monitor3) => {
            await sleepAsync(500);
            return ret;
          },
          options // { allowReentry: true }
        );
      });
    })).toBe(ret);
  });
 
  it("When reentrant locking is enabled, if `withLock` is called from within " +
    "a callback function using a different lock instance but the same key while the lock " + 
    "is already held, the call completes successfully.", async () => {

    const key = "testKey", retVal = "Reentrant-lock is enabled.";
    expect (await FileLock.withLock(key, async () => {
      // Clear the cache to create a new lock instance.
      FileLock.clearCache();

      return await FileLock.withLock(
        key, 
        async () => {
          await sleepAsync(500)
          return retVal;
        },
        { allowReentry: true }
      );
    })).toBe(retVal);
  });

  it("Since a different key is used, it completes successfully even if re-entry locking is disabled.", async () => {
    const key1 = "testKey1001", key2 = "testKey1002", retVal = "Different kyes's Reentrant-lock is ok.";
    expect(await FileLock.withLock(key1, async () => {
      return await FileLock.withLock(key2, async () => {
        await sleepAsync(500);
        return retVal;
      },
      { allowReentry: false }
    )})).toBe(retVal);
  });

  it("hogehoge", async () => {
  });
});
