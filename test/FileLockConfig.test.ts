import { describe, expect, it, vi, type Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { Config, FileLock, LockDirectoryCreationFailed, LockDirectoryStatFailed } from '../src/index';
import { logger, sleepAsync } from './FileLockTestCommon.ts'

describe('FileLock', () => {
  /*
  it("`FileLock.setConfig()` works correctly.", async () => {
    const orgConf = FileLock.getConfig();
    expect.assertions(3);
    try {
      FileLock.setConfig({});
      expect(JSON.stringify(FileLock.getDefaultConfig())).toBe(JSON.stringify(FileLock.getConfig()));
      const lockDirectory = 'hogehoge';
      let config: Config = {...FileLock.getDefaultConfig(), lockDirectory, cache: false, logger: new PrettyConsole() };
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
*/
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
      const lock = (FileLock as any).getLock(key) as any;
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
    let orgConf: Config;
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
    let orgConf: Config = FileLock.getConfig();
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
    expect.assertions(5);
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
      const lock = (FileLock as any).getLock(key) as any;
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
      const lock = (FileLock as any).getLock(key) as any;
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
      const lock = (FileLock as any).getLock(key) as any;
      expect(lock._logger.trace === lock._logger.debug).toBe(true);
      expect(lock._logger.fatal === lock._logger.error).toBe(true);
    }
    finally {
      FileLock.setConfig(orgConf);
    }

  });
});
