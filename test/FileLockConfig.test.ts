import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLockConfig, FileLock, FileLockError, LockDirectoryCreationFailed, LockDirectoryStatFailed } from '../src/index';
import { getLockMetaPath, logger, sleepAsync, TestLock } from './FileLockTestCommon.ts'

type NumberKeys<T> = {
    [K in keyof T]-?: T[K] extends number ? K : never
}[keyof T];

let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});

describe('FileLock', () => {

  it("`FileLock.setConfig()` works correctly.", () => {
    expect.assertions(3);
    FileLock.setConfig(FileLock.getDefaultConfig());
    expect(JSON.stringify(FileLock.getDefaultConfig())).toBe(JSON.stringify(FileLock.getConfig()));
    const lockDirectory = 'hogehoge';
    let config: FileLockConfig = {...FileLock.getDefaultConfig(), lockDirectory, cache: false, logger: new PrettyConsole() };
    FileLock.setConfig(config);
    const newConf = FileLock.getConfig();
    expect(JSON.stringify(newConf)).toBe(JSON.stringify(config));
    config = {...FileLock.getDefaultConfig(), defaultOptions: { ...FileLock.getDefaultOptions(), allowReentry: true } };
    FileLock.setConfig(config);
    expect(JSON.stringify(FileLock.getConfig())).toBe(JSON.stringify(config));
  });

  //class TestLock extends (FileLock as any) {};

  it("In `setConfig()`, if a value lower than the minimum is specified " +
    "for a numeric property among the default options, " +
    "the minimum value is set.", () => {
    const defaults = {
      timeoutMs:            -1,
      ttlMs:                -1,
      pollIntervalMs:       -1,
      heartbeatIntervalMs:  -1,
      heartbeatTtlMs:       -1,
      retriesOnIOErr:       -1,
      retryIntervalMs:      -1,
    };
    const exp = {
      timeoutMs:            0,
      ttlMs:                1000,
      pollIntervalMs:       100,
      heartbeatIntervalMs:  1000,
      heartbeatTtlMs:       2000,
      retriesOnIOErr:       0,
      retryIntervalMs:      100,
    };
    // Verify that the default option values ​​in the configuration settings are resolved.
    FileLock.setConfig({ defaultOptions: defaults });
    expect(TestLock.getConfig().defaultOptions).toMatchObject(exp);
  });

  it("`You can specify `console` as the logger, " +
    "and the `fatal` function has been replaced by the `error` function, " +
    "while the `trace` function has been replaced by the `debug` function..", async () => {

    const retVal = "test_001", key = retVal;
    expect.assertions(3);
    FileLock.setConfig({ logger: console });

    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal;
      },
      {}
    )).toBe(retVal);
    const lock = TestLock.getLock(key);
    // @ts-expect-error lock._logger is protected
    expect(lock._logger.trace).toBe(lock._logger.debug);
    // @ts-expect-error lock._logger is protected
    expect(lock._logger.fatal).toBe(lock._logger.error);
  });

/*
 async function testLockDirectoryCreation(dir: string, set: () => void, reset: () => void): Promise<void> {
    set();
    expect.assertions(5);
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
*/
  it("The directory specified in `FileLock.setCondig()` is created.", () => {
    const dir = path.join(process.cwd(), '.lock');
    fs.rmSync(dir, { force: true, recursive: true });
    expect(fs.existsSync(dir)).toBeFalsy();

    FileLock.setConfig({ lockDirectory: dir });

    expect(fs.existsSync(dir)).toBeTruthy();
    expect(fs.statSync(dir).isDirectory()).toBeTruthy();
  });

  it("If the user does not specify a lock directory, and an error occurs while attempting to create one based on `process.cwd()`," +
    " a error is throwed.", () => {
    const dir = path.join(process.cwd(), '.lock');
    expect.assertions(2);
    try {
      fs.rmSync(dir, { force: true, recursive: true });
      fs.writeFileSync(dir, "");
      FileLock.setConfig({ logger });
    }
    catch (err) {
      expect(err).instanceOf(LockDirectoryCreationFailed);
      expect(err).toMatchObject({ code: 'ELOCKDIRCREATE' });
    }
    finally {
      fs.rmSync(dir);
    }
  });

  async function testFsErrorBySpyOn(spyOnFnName: 'statSync' | 'mkdirSync', config: FileLockConfig, ErrorClass: new (...args:any[]) => Error): Promise<void>
  {
    const eCode = 'EHOGEHOGE';
    const eMsg = 'Hogehoge error!!';
    vi.spyOn(fs, spyOnFnName).mockImplementation(() => {
      const err = Object.assign(new Error(eMsg), { code: eCode });
      throw err;
    });
    expect.assertions(2);
    try {
      FileLock.setConfig({ ...config, logger });
      const retVal = "test_001", key = retVal;
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal;
        }
      );
    }
    catch (err) {
      expect(err instanceof ErrorClass).toBe(true);
      expect(err).toMatchObject({
        fsErrCode: eCode,
        fsErrMsg: eMsg,
      });
    }
  }

  it("An error occurs because the existence of the lock directory path cannot be verified (fs.statSync() error).", async () => {
    await testFsErrorBySpyOn('statSync', { lockDirectory: 'hogehoge' }, LockDirectoryStatFailed);
 });

  it("The lock directory path does not exist, so an attempt is made to create it, but an error occurs.", async () => {
    const lockDirectory = path.join(process.cwd(), '.lock1234');
    await testFsErrorBySpyOn('mkdirSync', { lockDirectory }, LockDirectoryCreationFailed);
    if (fs.existsSync(lockDirectory)) {
      fs.rmSync(lockDirectory, { force: true, recursive: true });
    }
  });

  it("An error occurs because the directory path specified in `FileLock.setConfig()` already exists but is not a directory.", async () => {
    const dir = path.join(process.cwd(), '.lock2');
    fs.writeFileSync(dir, "");
    expect.assertions(2);
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
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({ code: 'ENOTDIR' });
    }
    finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  it("Changing the directory path while a lock is held does not result in an error.", async () => {
    const retVal = "test_001", key = retVal;
    FileLock.setConfig({ logger: console });
    expect(await FileLock.withLock(key, 
      async () => {
        FileLock.setConfig({ lockDirectory: path.join(process.cwd(), 'test/tmp') });
        await sleepAsync(500);
        return retVal;
      },
      {}
    )).toBe(retVal);
  });

  it("Changing the directory path while a lock is held and then locking again using the same key does not result in an error.", async () => {
    const retVal = "test_001", key = retVal;
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
  });

  it("Changing the directory path while a lock is held and subsequently acquiring another lock " +
    "using the same key—while in reentrant lock permission mode—does not result in an error.", async () => {
    const retVal = "test_001", key = retVal;
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
  });

  it("When debug mode is enabled, the history is updated.", async () => {
    const hist = FileLock.getHistoryInfo().historyPath;//path.join(dir, 'history.json');
    if (fs.existsSync(hist) === false) fs.writeFileSync(hist, '');
    const stat_before = fs.statSync(hist);
    expect.assertions(1);
    FileLock.setConfig({ _debug: true, history: false });
    await FileLock.withLock('debug_mode_key', 
      async () => {
        await sleepAsync(500);
      },
    );
    const stat_after = fs.statSync(hist);
    expect(stat_before.mtimeMs).lessThan(stat_after.mtimeMs);
  });

  it("When debug mode is enabled, process-related information is appended to the meta-information.", async () => {
    const key = 'debug_mode_key_009'
    const metaFile = getLockMetaPath(key);
    expect.assertions(4);
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
  });

  function testConfigMinVal(key: keyof FileLockConfig, exp: number, val?: number, additinalExp?: () => void) {
    expect.assertions(additinalExp ? 2 : 1);
    const config = {} as Record<keyof NumberKeys<FileLockConfig>, number | undefined>;
    config[key] = val;
    FileLock.setConfig(config);
    const gConf = FileLock.getConfig();
    expect(gConf[key]).toBe(exp);
    if (additinalExp) additinalExp();
  }

  it("cacheMaxNum: undefined", () => {
    testConfigMinVal('cacheMaxNum', 100, undefined);
  });

  it("cacheMaxNum: 0", () => {
    testConfigMinVal('cacheMaxNum', 0, 0, () => expect(FileLock.getConfig().cache).toBeFalsy());
  });

  it("cacheMaxNum: -1", () => {
    testConfigMinVal('cacheMaxNum', 0, -1, () => expect(FileLock.getConfig().cache).toBeFalsy());
  });

  it("cacheMaxNum: 1", () => {
    testConfigMinVal('cacheMaxNum', 1, 1);
  });

  it("cacheTtlMs: undefined", () => {
    testConfigMinVal('cacheTtlMs', 10000, undefined);
  });

  it("cacheTtlMs: 0", () => {
    testConfigMinVal('cacheTtlMs', 10000, 0);
  });

  it("cacheTtlMs: -1", () => {
    testConfigMinVal('cacheTtlMs', 10000, -1);
  });

  it("cacheTtlMs: 10001", () => {
    testConfigMinVal('cacheTtlMs', 10001, 10001);
  });

  it("maxHistoryEntries: undefined", () => {
    testConfigMinVal('maxHistoryEntries', 100, undefined);
  });

  it("maxHistoryEntries: 0", () => {
    testConfigMinVal('maxHistoryEntries', 0, 0);
  });

  it("maxHistoryEntries: -1", () => {
    testConfigMinVal('maxHistoryEntries', 0, -1);
  });

  it("maxHistoryEntries: 99", () => {
    testConfigMinVal('maxHistoryEntries', 99, 99);
  });

  it("maxHistoryEntries: 101", () => {
    testConfigMinVal('maxHistoryEntries', 101, 101);
  });

  it("maxHistoryFiles: undefined", () => {
    testConfigMinVal('maxHistoryFiles', 100, undefined);
  });

  it("maxHistoryFiles: 0", () => {
    testConfigMinVal('maxHistoryFiles', 0, 0);
  });

  it("maxHistoryFiles: -1", () => {
    testConfigMinVal('maxHistoryFiles', 0, -1);
  });

  it("maxHistoryFiles: 99", () => {
    testConfigMinVal('maxHistoryFiles', 99, 99);
  });

  it("maxHistoryFiles: 101", () => {
    testConfigMinVal('maxHistoryFiles', 101, 101);
  });


});
