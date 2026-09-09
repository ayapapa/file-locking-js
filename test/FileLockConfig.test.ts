import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLockConfig, FileLock, FileLockError, LockDirectoryCreationFailed, LockDirectoryStatFailed } from '../src/index';
import { logger, sleepAsync } from './FileLockTestCommon.ts'

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('FileLock', () => {

  it("`FileLock.setConfig()` works correctly.", async () => {
    const orgConf = FileLock.getConfig();
    expect.assertions(3);
    try {
      FileLock.setConfig(FileLock.getDefaultConfig());
      const def = FileLock.getDefaultConfig();
      const cur = FileLock.getConfig();
      expect(JSON.stringify(FileLock.getDefaultConfig())).toBe(JSON.stringify(FileLock.getConfig()));
      const lockDirectory = 'hogehoge';
      let config: FileLockConfig = {...FileLock.getDefaultConfig(), lockDirectory, cache: false, logger: new PrettyConsole() };
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

  class TestLock extends (FileLock as any) {};

  it("数値系オプションに最小値未満を設定すると、最小値2000がセットされる.", async () => {
    const defaults = {
      timeoutMs:            -1,
      ttlMs:                -1,
      pollIntervalMs:       -1,
      heartbeatIntervalMs:  -1,
      heartbeatTimeoutMs:   -1,
      retriesOnIOErr:       -1,
      retryIntervalMs:      -1,
    };
    const exp = {
      timeoutMs:            0,
      ttlMs:                1000,
      pollIntervalMs:       100,
      heartbeatIntervalMs:  1000,
      heartbeatTimeoutMs:   2000,
      retriesOnIOErr:       0,
      retryIntervalMs:      100,
    };
    // コンフィグ設定におけるデフォルトオプションの値は解決されることを確認
    FileLock.setConfig({ defaultOptions: defaults });
    const udo = TestLock.getConfig().defaultOptions;
    expect(TestLock.getConfig().defaultOptions).toMatchObject(exp);
  });

  it("`You can specify `console` as the logger, " +
    "and the `fatal` function has been replaced by the `error` function, " +
    "while the `trace` function has been replaced by the `debug` function..", async () => {

    const orgConf = FileLock.getConfig();
    const retVal = "test_001", key = retVal;
    //expect.assertions(3);
    try {
      FileLock.setConfig({ logger: console });

      expect(await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        },
        {}
      )).toBe(retVal);
      const lock = (FileLock as any)._getLock(key) as any;
      expect(lock._logger.trace === lock._logger.debug).toBe(true);
      expect(lock._logger.fatal === lock._logger.error).toBe(true);
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

      let ret;
      try {
        ret = await FileLock.withLock(key, 
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
      expect(ret).toBe(retVal)
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
    console.log("######START The directory specified...#####");
    const dir = path.join(process.cwd(), '.lock');
    let orgConf: FileLockConfig;
    await testLockDirectoryCreation(
      dir,
      () => {
        orgConf = FileLock.getConfig();
        FileLock.setConfig({ lockDirectory: dir, logger });
      },
      () => FileLock.setConfig(orgConf),
    );
  });

  it("If the user does not specify a lock directory, and an error occurs while attempting to create one based on `process.cwd()`," +
    " a error is throwed.", async () => {
    const dir = path.join(process.cwd(), '.lock');
    let orgConf: FileLockConfig = FileLock.getConfig();
    FileLock.setConfig({ logger });
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

  async function testFsErrorBySpyOn(spyOnFnName: 'statSync' | 'mkdirSync', config: FileLockConfig, ErrorClass: new (...args:any[]) => Error): Promise<void>
  {
    const eCode = 'EHOGEHOGE';
    const eMsg = 'Hogehoge error!!';
    const spy = vi.spyOn(fs, spyOnFnName).mockImplementation(() => {
      const err = Object.assign(new Error(eMsg), { code: eCode });
      throw err;
    });
    expect.assertions(3);
    const orgConf = FileLock.getConfig();
    FileLock.setConfig({ ...config, logger });
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
      expect(err.fsErrCode).toBe(eCode);
      expect(err.fsErrMsg).toBe(eMsg);
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
    //expect.assertions(5);
    const orgConf = FileLock.getConfig();
    try {
      FileLock.setConfig({ lockDirectory: dir, logger });
      const retVal = "test_001", key = retVal;
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        }
      )
    }
    catch (err: any) {
      expect(err).instanceOf(FileLockError);
      expect(err.code).toBe('ENOTDIR');
      /*
      expect(err.fsErrorCode).toBe('ENOTDIR');
      expect(err.fsErrorMsg.includes(dir)).toBe(true);
      expect(err.fsErrorMsg.includes('not a directory')).toBe(true);
      */
    }
    finally {
      fs.rmSync(dir, { force: true, recursive: true });
      FileLock.setConfig(orgConf);
    }
  });

  it("Changing the directory path while a lock is held does not result in an error.", async () => {

    const orgConf = FileLock.getConfig();
    const retVal = "test_001", key = retVal;
    expect.assertions(3);
    try {
      FileLock.setConfig({ logger: console });
      expect(await FileLock.withLock(key, 
        async () => {
          FileLock.setConfig({ lockDirectory: path.join(process.cwd(), 'test/tmp') });
          await sleepAsync(500);
          return retVal;
        },
        {}
      )).toBe(retVal);
      const lock = (FileLock as any)._getLock(key) as any;
      expect(lock._logger.trace === lock._logger.debug).toBe(true);
      expect(lock._logger.fatal === lock._logger.error).toBe(true);
    }
    finally {
      FileLock.setConfig(orgConf);
    }

  });

  it("Changing the directory path while a lock is held and then locking again using the same key does not result in an error.", async () => {

    const orgConf = FileLock.getConfig();
    const retVal = "test_001", key = retVal;
    expect.assertions(3);
    try {
      FileLock.setConfig({ logger: console });
      expect(await FileLock.withLock(key, 
        async () => {
          FileLock.setConfig({ lockDirectory: path.join(process.cwd(), 'test/tmp') });
          await FileLock.withLock(key, 
            () => {
              return;
            }
          );
          await sleepAsync(500);
          return retVal;
        },
        {}
      )).toBe(retVal);
      const lock = (FileLock as any)._getLock(key) as any;
      expect(lock._logger.trace === lock._logger.debug).toBe(true);
      expect(lock._logger.fatal === lock._logger.error).toBe(true);
    }
    finally {
      FileLock.setConfig(orgConf);
    }

  });

  it("Changing the directory path while a lock is held and subsequently acquiring another lock " +
    "using the same key—while in reentrant lock permission mode—does not result in an error.", async () => {

    const orgConf = FileLock.getConfig();
    const retVal = "test_001", key = retVal;
    expect.assertions(3);
    try {
      FileLock.setConfig({ logger: console });
      expect(await FileLock.withLock(key, 
        async () => {
          FileLock.setConfig({ lockDirectory: path.join(process.cwd(), 'test/tmp') });
          await FileLock.withLock(key, 
            () => {
              return;
            },
            { allowReentry: true }
          );
          await sleepAsync(500);
          return retVal;
        },
      )).toBe(retVal);
      const lock = (FileLock as any)._getLock(key) as any;
      expect(lock._logger.trace === lock._logger.debug).toBe(true);
      expect(lock._logger.fatal === lock._logger.error).toBe(true);
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

  it("When debug mode is enabled, the history is updated.", async () => {
    const orgConf = FileLock.getConfig();
    const dir = path.join(process.cwd(), '.lock');
    const hist = path.join(dir, 'history.json');
    if (fs.existsSync(hist) === false) fs.writeFileSync(hist, '');
    const stat_before = fs.statSync(hist);
    expect.assertions(1);
    try {
      FileLock.setConfig({ _debug: true, history: false });
      await FileLock.withLock('debug_mode_key', 
        async () => {
          await sleepAsync(500);
        },
      );
      const stat_after = fs.statSync(hist);
      expect(stat_before.mtimeMs).lessThan(stat_after.mtimeMs);
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

  it("When debug mode is enabled, process-related information is appended to the meta-information.", async () => {
    const orgConf = FileLock.getConfig();
    const key = 'debug_mode_key_009'
    const dir = path.join(process.cwd(), '.lock');
    const metaFile = path.join(dir, key, 'meta.json');
    expect.assertions(4);
    try {
      FileLock.setConfig({ _debug: true });
      await FileLock.withLock(key, 
        async () => {
          const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
          expect(meta.processId).toBeTypeOf('number');
          expect(meta.parentProcessId).toBeTypeOf('number');
          expect(Array.isArray(meta.processArgv) && (meta.processArgv as unknown[]).every(v => typeof v === "string")).toBeTruthy();
          expect(meta.callStack).toBeTypeOf('string');
          await sleepAsync(500);
        },
      );
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

  it("cacheMaxNumをundefined指定.", async () => {
    const orgConf = FileLock.getConfig();
    expect.assertions(1);
    try {
      FileLock.setConfig({ cacheMaxNum: undefined });
      const config = FileLock.getConfig();
      expect(config.cacheMaxNum).toBe(100);
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

  // cacheMaxNum 0
  it("cacheMaxNumを0.", async () => {
    const orgConf = FileLock.getConfig();
    expect.assertions(2);
    try {
      FileLock.setConfig({ cacheMaxNum: 0 });
      const config = FileLock.getConfig();
      expect(config.cacheMaxNum).toBe(0);
      expect(config.cache).toBeFalsy();
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

  //cacheTtlMs 
  it("cacheTtlMsをunddfined.", async () => {
    const orgConf = FileLock.getConfig();
    expect.assertions(1);
    try {
      FileLock.setConfig({ cacheTtlMs: undefined });
      const config = FileLock.getConfig();
      expect(config.cacheTtlMs).toBe(50000);
    }
    finally {
      FileLock.setConfig(orgConf);
    }
  });

});
