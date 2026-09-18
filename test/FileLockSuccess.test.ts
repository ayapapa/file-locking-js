import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHistoryPath, getLockMetaPath, logger, sleepAsync, TestLock  } from './FileLockTestCommon.ts';
import { FileLockConfig, FileLock, FileLockOptions } from '../src/index';
import fs from 'node:fs';
import path from 'node:path';

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('FileLock', () => {

  it("The lock is successfully acquired, and the return value of the callback is obtained.", async () => {
    const retVal = "test_00111", key = retVal;
    const opts =  {timeoutSec : 1 } as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("The process completes without interference between the two locks using different keys.", async () => {
    const key1 = 'testKey1', retVal1 = key1;
    const a =  FileLock.withLock("testKey1", 
      async () => {
        await sleepAsync(3000);
        return retVal1;
      },
      { timeoutSec : 1 }
    );
    
    const key2 = 'testKey2', retVal2 = key2;
    const b =  FileLock.withLock("testKey2", 
      async () => {
        await sleepAsync(3000);
        return retVal2;
      },
      { timeoutSec : 1 }
    );
    let res: unknown[] = [];
    try {
      res = await Promise.all([a, b])
    }
    catch (err) {
      console.log(err);
    }
    expect(res).toHaveLength(2);
    expect(res[0]).toBe(retVal1);
    expect(res[1]).toBe(retVal2);
    expect(TestLock.isReleasedState(key1)).toBeTruthy();
    expect(TestLock.isReleasedState(key2)).toBeTruthy();
  });

  it("If reentrant locking is enabled, calling `withLock` with the same key from within " +
    "a callback function while the lock is already held will complete successfully.", async () => {

    const key = "testKey", retVal = "Reentrant-lock is enabled.";
    expect (await FileLock.withLock(key, 
      async (monitor) => {
        return await FileLock.withLock(
          key, 
          async (monitor2) => {
            // The monitor should be shared when the key is re-entered (re-entrant lock).
            expect(monitor2).toBe(monitor);
            await sleepAsync(500)
            return retVal;
          },
          { allowReentry: true }
        );
      }
    )).toBe(retVal);
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("With three-level lock nesting, if `options.allowReentry` is set to `true`, " +
    "the operation completes successfully even if the first and third locks target the same key.", async () => {
 
    const key1 = "testKey_10000", key2 = 'testKey_20000';
    const ret = "OK";
    const options: FileLockOptions = { allowReentry: true }
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
    expect(TestLock.isReleasedState(key1)).toBeTruthy();
    expect(TestLock.isReleasedState(key2)).toBeTruthy();
  });
 
  it("When reentrant locking is enabled, if `withLock` is called from within " +
    "a callback function using a different lock instance but the same key while the lock " + 
    "is already held, the call completes successfully.", async () => {

    const key = "testKey", retVal = "Reentrant-lock is enabled.";
    expect (await FileLock.withLock(key, async () => {
      // Clear the cache to create a new lock instance.
      TestLock.clearCache();

      return await FileLock.withLock(
        key, 
        async () => {
          await sleepAsync(500)
          return retVal;
        },
        { allowReentry: true }
      );
    })).toBe(retVal);
    expect(TestLock.isReleasedState(key)).toBeTruthy();
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
    expect(TestLock.isReleasedState(key1)).toBeTruthy();
    expect(TestLock.isReleasedState(key2)).toBeTruthy();
  });

  it("When debug mode is enabled, if no history, it has to be created.", async () => {
    const hist = getHistoryPath();
    const hist_bu = hist + '.backup';
    if (fs.existsSync(hist)) {
      fs.renameSync(hist, hist_bu);
    }
    expect.assertions(1);
    FileLock.setConfig({ _debug: true });
    try {
      await FileLock.withLock('debug_mode_key', 
        async () => {
          await sleepAsync(100);
        },
      );
      expect(fs.existsSync(hist)).toBeTruthy();
    }
    finally {
      if (fs.existsSync(hist)) {
        fs.rmSync(hist);
      }
      if (fs.existsSync(hist_bu)) {
        fs.renameSync(hist_bu, hist);
      }
    }
  });

  it("maxHistoryEntries: 1", async () => {
    const hist = getHistoryPath();
    FileLock.setConfig({ _debug: true, maxHistoryEntries: 1 });
    expect.assertions(2);
    try {
      await FileLock.withLock('debug_mode_key', 
        async () => {
          await sleepAsync(100);
        },
      );
      expect(fs.existsSync(hist)).toBeTruthy();
      const h = JSON.parse(fs.readFileSync(hist, 'utf-8'));
      expect(Object.keys(h).length).toBe(1);
    }
    finally {
    }
  });

  it("maxHistoryEntries: 0", async () => {
    const hist = getHistoryPath();
    FileLock.setConfig({ _debug: true, maxHistoryEntries: 0 });
    await FileLock.withLock('debug_mode_key', 
      async () => {
        await sleepAsync(100);
      },
    );
    expect(fs.existsSync(hist)).toBeTruthy();
    const c = fs.readFileSync(hist, 'utf-8');
    const h = JSON.parse(c);
    expect(Object.keys(h).length).toBe(0);
  });

});
