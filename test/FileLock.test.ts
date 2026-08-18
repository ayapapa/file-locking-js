import { describe, expect, it, vi, type Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { Config, FileLock, FileLockError, FileLockUserOptions, LogProvider, LockDirectoryCreationFailed, LockDirectoryStatFailed } from '../src/index';
async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('FileLock', () => {

  function testToBeSameAsTheDefaultOptions(opts: FileLockUserOptions): void {
    // Check basic options
    expect(opts.timeoutSec).toBeUndefined();
    expect(opts.timeoutMs).toBe(5000);
    expect(opts.ttlSec).toBeUndefined();
    expect(opts.ttlMs).toBe(10000);
    expect(opts.allowReentry).toBe(false);
    expect(opts.logger).toBe(console); // default
    // Check basic options
    expect(opts.pollIntervalSec).toBeUndefined();
    expect(opts.pollIntervalMs).toBe(100);
    expect(opts.heartbeatIntervalSec).toBeUndefined();
    expect(opts.heartbeatIntervalMs).toBe(1000);
    expect(opts.heartbeatTimeoutSec).toBeUndefined();
    expect(opts.heartbeatTimeoutMs).toBe(10000);
    expect(opts.retriesOnIOErr).toBe(1);
    expect(opts.retryIntervalSec).toBeUndefined();
    expect(opts.retryIntervalMs).toBe(100);
  }

  it("Default options are valid.", async () => {
    testToBeSameAsTheDefaultOptions(FileLock.getDefaultOptions());
  });

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

  it("When the lock with no options, internally resolved options are same as the default options.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {} as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    testToBeSameAsTheDefaultOptions(opts._resolvedOpts);
  });

  it("When the lock with xxxSec options only,  internally resolved options have valid calculated xxxMs properties.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {timeoutSec : 1.2,  ttlSec: 1.00001, pollIntervalSec: 0.11, heartbeatIntervalSec: 1.1, heartbeatTimeoutSec: 10.002555, retryIntervalSec: 0.213} as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    const defaultOpts = FileLock.getDefaultOptions();
    // Check basic options
    expect(opts._resolvedOpts.timeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.timeoutMs).toBe(Math.floor(opts.timeoutSec * 1000)); 
    expect(opts._resolvedOpts.ttlSec).toBeUndefined();
    expect(opts._resolvedOpts.ttlMs).toBe(Math.floor(opts.ttlSec * 1000));
    expect(opts._resolvedOpts.allowReentry).toBe(defaultOpts.allowReentry);
    expect(opts._resolvedOpts.logger).toBe(defaultOpts.logger);
    // Check basic options
    expect(opts._resolvedOpts.pollIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.pollIntervalMs).toBe(Math.floor(opts.pollIntervalSec * 1000));
    expect(opts._resolvedOpts.heartbeatIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatIntervalMs).toBe(Math.floor(opts.heartbeatIntervalSec * 1000));
    expect(opts._resolvedOpts.heartbeatTimeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatTimeoutMs).toBe(Math.floor(opts.heartbeatTimeoutSec * 1000));
    expect(opts._resolvedOpts.retriesOnIOErr).toBe(defaultOpts.retriesOnIOErr);
    expect(opts._resolvedOpts.retryIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.retryIntervalMs).toBe(Math.floor(opts.retryIntervalSec * 1000));
    expect(opts._resolvedOpts.resolved).toBe(true);
  });

  it("When the lock with options other than time-related ones,  internally resolved options are valid.", async () => {
    const retVal = "test_001", key = retVal;
    const logger: LogProvider = new PrettyConsole();
    const opts =  { allowReentry: true, logger: logger, retriesOnIOErr: 2 } as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    const defaultOpts = FileLock.getDefaultOptions();
    // Check basic options
    expect(opts._resolvedOpts.timeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.timeoutMs).toBe(defaultOpts.timeoutMs);
    expect(opts._resolvedOpts.ttlSec).toBeUndefined();
    expect(opts._resolvedOpts.ttlMs).toBe(defaultOpts.ttlMs);
    expect(opts._resolvedOpts.allowReentry).toBe(opts.allowReentry);
    expect(opts._resolvedOpts.logger).toBe(opts.logger);
    // Check basic options
    expect(opts._resolvedOpts.pollIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.pollIntervalMs).toBe(defaultOpts.pollIntervalMs);
    expect(opts._resolvedOpts.heartbeatIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatIntervalMs).toBe(defaultOpts.heartbeatIntervalMs);
    expect(opts._resolvedOpts.heartbeatTimeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatTimeoutMs).toBe(defaultOpts.heartbeatTimeoutMs);
    expect(opts._resolvedOpts.retriesOnIOErr).toBe(opts.retriesOnIOErr);
    expect(opts._resolvedOpts.retryIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.retryIntervalMs).toBe(defaultOpts.retryIntervalMs);
    expect(opts._resolvedOpts.resolved).toBe(true);
  });

  it("`FileLock.setConfig()` works correctly.", async () => {
    const orgConf = FileLock.getConfig();
    expect.assertions(3);
    try {
      FileLock.setConfig({});
      expect(JSON.stringify(FileLock.getDefaultConfig())).toBe(JSON.stringify(FileLock.getConfig()));
      const lockDirectory = 'hogehoge';
      let config: Config = {...FileLock.getDefaultConfig(), lockDirectory, cache: false };
      FileLock.setConfig(config);
      expect(JSON.stringify(FileLock.getConfig())).toBe(JSON.stringify(config));
      config = {...FileLock.getDefaultConfig(), defaultOptions: { ...FileLock.getDefaultOptions(), allowReentry: true } };
      FileLock.setConfig(config);
      expect(JSON.stringify(FileLock.getConfig())).toBe(JSON.stringify(config));
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

  async function testLockDirectoryCreation(dir: string, set: () => void, reset: () => void): Promise<void> {
    set();
    try {
      const retVal = "test_001", key = retVal;
      fs.rmSync(dir, { force: true, recursive: true });
      expect(fs.existsSync(dir)).toBe(false);
      expect(await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        },
        {}
      )).toBe(retVal);
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
      fs.rmSync(dir, { force: true, recursive: true });
      expect(fs.existsSync(dir)).toBe(false);
    }
    finally {
      reset();
    }
  }

  it("The directory specified in `FileLock.setCondig()` is created.", async () => {
    const dir = path.join(process.cwd(), '.lock');
    let orgConf: Config;
    testLockDirectoryCreation(
      dir,
      () => {
        orgConf = FileLock.getConfig();
        FileLock.setConfig({ lockDirectory: dir });
      },
      () => FileLock.setConfig(orgConf),
    );
  });

  it("If the user does not specify a lock directory, a lock directory is created based on `process.cwd()`.", async () => {
    const dir = path.join(process.cwd(), '.lock');
    let orgConf: Config;
    let orgDir: string | undefined;
    testLockDirectoryCreation(
      dir,
      () => {
        orgConf = FileLock.getConfig();
        FileLock.setConfig({});
        orgDir = process.env['AYPP_FILELOCK_DIR'];
        delete process.env['AYPP_FILELOCK_DIR'];
      },
      () => {
        FileLock.setConfig(orgConf);
        if (orgDir) process.env['AYPP_FILELOCK_DIR'] = orgDir;
      }
    );
  });

  it("If the user does not specify a lock directory, and an error occurs while attempting to create one based on `process.cwd()`," +
    " a error is throwed.", async () => {
    const dir = path.join(process.cwd(), '.lock');
    let orgConf: Config;
    orgConf = FileLock.getConfig();
    FileLock.setConfig({});
    fs.rmSync(dir, { force: true, recursive: true });
    fs.writeFileSync(dir, "");
    expect.assertions(2);
    try {
      const retVal = "test_001", key = retVal;
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        },
        {}
      );
    }
    catch (err: any) {
      expect(err instanceof LockDirectoryCreationFailed).toBe(true);
      expect(err.code).toBe('ELOCKDIRCREATE')
    }
    finally {
      FileLock.setConfig(orgConf);
      fs.rmSync(dir);
    }
  });

  async function testFsErrorBySpyOn(spyOnFnName: 'statSync' | 'mkdirSync', config: Config, ErrorClass: new (...args:any[]) => Error): Promise<void>
  {
    const eCode = 'EHOGEHOGE';
    const eMsg = 'Hogehoge error!!';
    const spy = vi.spyOn(fs, spyOnFnName).mockImplementation(() => {
      const err = Object.assign(new Error(eMsg), { code: eCode });
      throw err;
    });
    expect.assertions(3);
    const orgConf = FileLock.getConfig();
    FileLock.setConfig(config);
    try {
      const retVal = "test_001", key = retVal;
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        }
      );
    }
    catch (err: any) {
      expect(err instanceof ErrorClass).toBe(true);
      expect(err.fsErrorCode).toBe(eCode);
      expect(err.fsErrorMsg).toBe(eMsg);
    }
    finally {
      spy.mockRestore();
      FileLock.setConfig(orgConf);
    }
  }

  it("An error occurs because the existence of the lock directory path cannot be verified (fs.statSync() error).", async () => {
    await testFsErrorBySpyOn('statSync', { lockDirectory: 'hogehoge' }, LockDirectoryStatFailed);
 });

  it("The lock directory path does not exist, so an attempt is made to create it, but an error occurs.", async () => {
    await testFsErrorBySpyOn('mkdirSync', { lockDirectory: path.join(process.cwd(), '.lock') }, LockDirectoryCreationFailed);
  });

  it("An error occurs because the directory path specified in `FileLock.setConfig()` already exists but is not a directory.", async () => {
    const dir = path.join(process.cwd(), '.lock');
    fs.writeFileSync(dir, "");
    expect.assertions(5); // 例外は1回おきるはず
    const orgConf = FileLock.getConfig();
    try {
      FileLock.setConfig({ lockDirectory: dir });
      const retVal = "test_001", key = retVal;
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        }
      )
    }
    catch (err: any) {
      expect(err instanceof LockDirectoryStatFailed).toBe(true);
      expect(err.code).toBe('ELOCKDIRSTAT');
      expect(err.fsErrorCode).toBe('ENOTDIR');
      expect(err.fsErrorMsg.includes(dir)).toBe(true);
      expect(err.fsErrorMsg.includes('not a directory')).toBe(true);
    }
    finally {
      fs.rmSync(dir, { force: true, recursive: true });
      FileLock.setConfig(orgConf);
    }
  });

  it("After clearing the cache, the number of cache entries is 0.", async () => {
    const retVal = "test_001", key = retVal;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal;
      }
    )).toBe(retVal);
    expect((FileLock as any).cache.size > 0).toBe(true);  
    FileLock.clearCache();
    expect((FileLock as any).cache.size).toBe(0);  
  });

  async function testCacheStatus(config: Config, checkStatus: () => Promise<void>): Promise<void> {
    FileLock.clearCache();
    const orgConf = FileLock.getConfig();
    FileLock.setConfig(config);
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

  /* 以下、資産管理プロジェクトから持ってこい！！
  it("test_InterProcessLock_success"), () => {
    // 非同期で3秒スリープする関数を、別キーで複数回呼び出してみる
    const a =  FileLock.withLock("testKey1", 
      async () => {
        await sleepAsync(500);
      },
      {timeoutSec : 1 }
    );
    
    const b =  FileLock.withLock("testKey2", 
      async () => {
        await sleepAsync(500);
      },
      {timeoutSec : 1 }
    );
    let res;
    expect(res = await Promise.all([a, b])).toHaveLength(2);
    expect(res[0]).toBeUndefined();
    expect(res[1]).toBeUndefined();
  }
*/
});
