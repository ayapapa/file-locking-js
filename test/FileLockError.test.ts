import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import fs, { PathLike } from 'node:fs';
import { getHistoryPath, getLockMeta, getLockMetaPath, removeLockFiles, setLockMeta, sleepAsync, TestLock  } from './FileLockTestCommon.ts';
import { AlreadyLocked, FileLockConfig, DeadlockDetected, FileLock, FileLockError, LockDirectoryCreationFailed, 
  LockDirectoryStatFailed, LockError, LockFileBroken, InvalidOptions, LockCompromised, TTLExceeded, type Monitor } from '../src/index.ts';

let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});

describe('FileLockError', () => {

  it("If you instantiate FileLockError without arguments, the code property becomes 'EFILELOCK'.", () => {
    const err = new FileLockError();
    expect(err).toMatchObject({
      code: 'EFILELOCK'
    });
  });

  it("An error occurs if `key` is not specified.", async () => {
    let key;
    expect.assertions(3);
    try {
      await FileLock.withLock(key as any, async () => {
          await sleepAsync(500);
        },
        {timeoutSec : 1 }
      );
    }
    catch (err) {
      if (err instanceof Error) {
        expect(err).instanceOf(InvalidOptions);
        expect('code' in err && err.code === 'EINVAL').toBeTruthy();
        expect(err.message).contains("`key` must be specified as a non-empty string.");
      }
    }
  });

  it("Forge lock for the same `key` to trigger a timeout.", async () => {
    const key = "testKey";
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 5*60*1000, heartbeatTtlMs:10000, lastHeartbeatAt: Date.now()};
    setLockMeta(key, meta);
    expect.assertions(4);
    try {
      await FileLock.withLock(key, async () => {
          await sleepAsync(500);
        },
        {timeoutSec : 0.1 }
      );
    }
    catch (err: any) {
      expect(err.code).toBe('ELOCKED');
      expect(err.key).toBe(key);
      expect(err instanceof AlreadyLocked).toBe(true);
      expect(err.message.includes("Could not lock because the")).toBe(true);
    }
    finally {
      removeLockFiles(key);
    }
  });

  it("Calling `withLock` with the same `key` twice asynchronously results " +
    "in the second lock timing out when using `Promise.all()`.", async () => {
    const key = "testKey";
    const a =  FileLock.withLock(key, async () => {
        await sleepAsync(200);
      },
      {timeoutSec : 1 }
    );
    const b =  FileLock.withLock(key, async () => {
        await sleepAsync(100);
      },
      { timeoutSec : 0.1 }
    );
    expect.assertions(4);
    try {
      await Promise.all([a, b]);
    }
    catch (err: any) {
      expect(err.code).toBe('ELOCKED');
      expect(err.key).toBe(key);
      expect(err instanceof AlreadyLocked).toBe(true);
      expect(err.message.includes("Could not lock because the")).toBe(true);
    }
    finally {
      try {await a} catch(e) {};
    }
  });

  it("Calling `withLock` with the same key inside a callback function "+
    "that is already holding the lock results in a deadlock error.", async () => {

    const key = "testKey";
    expect.assertions(4);
    try {
      await FileLock.withLock(key, async () => {
        await FileLock.withLock(key, async () => {
          await sleepAsync(500);
        });
      });
    } catch (err: any) {
      expect(err.code).toBe('EDEADLK');
      expect(err.key).toBe(key);
      expect(err instanceof DeadlockDetected).toBe(true);
      expect(err.message.includes("A deadlock was detected.")).toBe(true);
    }
  });

  it("With three-level lock nesting, `DeadlockDetected` error occurs when the first and third locks target the same key.", async () => {
 
    const key1 = "testKey_10000", key2 = 'testKey_20000';
    expect.assertions(4);
    try {
      await FileLock.withLock(key1, async () => {
        await FileLock.withLock(key2, async () => {
          await FileLock.withLock(key1, async () => {
            await sleepAsync(500);
          });
        });
      });
    } catch (err: any) {
      expect(err.code).toBe('EDEADLK');
      expect(err.key).toBe(key1);
      expect(err instanceof DeadlockDetected).toBe(true);
      expect(err.message.includes("A deadlock was detected.")).toBe(true);
    }
  });

  it("A`DeadlockDetected` error occurs occurs even when the lock instances are different.", async () => {

    const key = "testKey";
    expect.assertions(4);
    try {
      await FileLock.withLock(key, async () => {
        // Clear the cache to create a new lock instance.
        TestLock.clearCache();

        await FileLock.withLock(key, async () => {
          await sleepAsync(500);
        });
      });
    } catch (err: any) {
      expect(err.code).toBe('EDEADLK');
      expect(err.key).toBe(key);
      expect(err instanceof DeadlockDetected).toBe(true);
      expect(err.message.includes("A deadlock was detected.")).toBe(true);
    }
  });

  // If a lock interruption occurs, wait until the callback completes.
  async function waitCallbackCompletedByCancelled(
    lockFn: (cb: (monitor: Monitor)=>Promise<void>) => Promise<void>,
    lockCallback: (monitor: Monitor, callbackCompleted: (v: unknown) => void) => Promise<void>,
    errorFn: (err: any) => void,
    finnalyFn: () => void = () => {}
  ): Promise<void> {

    let callbackCompleted: (v: unknown) => void;
    const callbackPromise = new Promise(resolve => {
      callbackCompleted = resolve;
    });
    try {
      await lockFn(async (monitor) => {
        await lockCallback(monitor, callbackCompleted);
        callbackCompleted('Completed.');
      });
    }
    catch (err) {
      errorFn(err);
    }
    finally {
      finnalyFn();
    }
    await callbackPromise;
  }

  it("An error occurs if a compromise is detected within a callback function while the lock is held.", async () => {

    const key = "testKey999";
    expect.assertions(6);

    await waitCallbackCompletedByCancelled(
      async (callback:(monitor: Monitor)=>Promise<void>) => {
        await FileLock.withLock(
          key, 
          async (monitor: Monitor) => await callback(monitor),
          {ttlMs: 2000}
        )
      },
      async (monitor: Monitor, callbackCompleted) => {
        try {
          expect(monitor.cancelled).toBeFalsy();
          // Compromised
          const meta = getLockMeta(key);
          meta.ownerId = crypto.randomUUID();
          setLockMeta(key, meta);
          // Since the heartbeat causes an error, wait at least one second.
          await sleepAsync(1001);
          expect(monitor.cancelled).toBeTruthy();
          expect(monitor.reason).toBe('ECOMPROMISED');
        }
        finally {
          callbackCompleted('Completed');
        }
      },
      (err) => {
        expect(err).instanceOf(LockCompromised);
        expect(err.code).toBe('ECOMPROMISED');
        expect(err.message).contains("has been compromised");
      },
      () => removeLockFiles(key)
    );
  });

  it("Intentionally overwriting the lock file within a reentrant lock callback results " +
    "in `LockCompromised` error being thrown.", async () => {

    const key = "testKey_9989";
    expect.assertions(9);

    let completedCallbacks = 0;

    await waitCallbackCompletedByCancelled(
      async (callback:(monitor: Monitor)=>Promise<void>) => {
        await FileLock.withLock(
          key,
          async (monitor) => await callback(monitor),
          {ttlMs: 10000}
        );
      },
      async (monitor: Monitor, callbackCompleted) => {
        expect(monitor.cancelled).toBeFalsy();
        try {
          await FileLock.withLock(
            key,
            async (monitor2: Monitor) => {
              expect(monitor2.cancelled).toBeFalsy();
              // Compromised
              const meta = getLockMeta(key);
              meta.ownerId = crypto.randomUUID();
              setLockMeta(key, meta);
              await sleepAsync(1100);
              expect(monitor2.cancelled).toBeTruthy();
              expect(monitor2.reason).toBe('ECOMPROMISED');
              if (++completedCallbacks >= 2) callbackCompleted('Completed.');
            },
            {ttlMs: 2000, allowReentry: true}
          );
          await sleepAsync(2000);
        }
        catch (err) {
          throw err;
        }
        finally {
          expect(monitor.cancelled).toBeTruthy();
          expect(monitor.reason).toBe('ECOMPROMISED');
          if (++completedCallbacks >= 2) callbackCompleted('Completed.');
        }
      },
      (err) => {
        expect(err).instanceOf(LockCompromised);
        expect(err.code).toBe('ECOMPROMISED');
        expect(err.message).contains("has been compromised");
      },
      () => removeLockFiles(key)
    );
  });
 
  it("`TTLExceeded` error occurs if the callback processing exceeds the TTL setting.", async () => {
    const key = "testKey";
    expect.assertions(4); 
    await waitCallbackCompletedByCancelled(
      async (callback) => {
        await FileLock.withLock(
          key,
          async (monitor) => await callback(monitor),
          {ttlMs: 500}
        )
      },
      async (monitor, callbackCompleted) => {
        expect(monitor.cancelled).toBeFalsy();
        await sleepAsync(1000);
        expect(monitor.cancelled).toBeTruthy();
        expect(monitor.reason).toBe('ETTLEXCEEDED');
        callbackCompleted('Completed.')
      },
      (err) => expect(err).instanceOf(TTLExceeded)
    );
  });

  function testNoParamsError(ErrorClass: new(...args: any[]) => Error, msg?: string, param?: {}) {
    const err = new ErrorClass(null, param);
    msg ? expect(err.message).toBe(msg) : expect(err.message).toBe('null');
  }

  it("Instantiating an error class without parameters results in the default message.(TTLExceeded).", async () => {
    testNoParamsError(LockError);
  });

  it("Instantiating an error class without parameters results in the default message.(TTLExceeded).", async () => {
    testNoParamsError(TTLExceeded, 'The maximum processing time(options.ttlMs milliseconds) while locked has been exceeded.');
  });

  it("Instantiating an error class without parameters results in the default message.(AlreadyLocked).", async () => {
    testNoParamsError(AlreadyLocked , "Could not lock because the 'key' is already locked.");
  });

  it("Instantiating an error class without parameters results in the default message.(InvalidOptions).", async () => {
    testNoParamsError(InvalidOptions  , "The value of the specified options is invalid.");
  });
  
  it("Instantiating an error class without parameters results in the default message.(DeadlockDetected).", async () => {
    testNoParamsError(DeadlockDetected  , "A deadlock was detected.");
  });

  //LockDirectoryAccessFailed 
  it("Instantiating an error class without parameters results in the default message.(LockDirectoryStatFailed).", async () => {
    testNoParamsError(LockDirectoryStatFailed  , "Failed to check the status of the lock directory.");
  });

  it("Instantiating an error class without parameters results in the default message.(LockDirectoryCreationFailed).", async () => {
    testNoParamsError(LockDirectoryCreationFailed  , "Failed to create the lock directory.");
  });

  //LockCompromised 
  it("Instantiating an error class without parameters results in the default message.(LockCompromised).", async () => {
    testNoParamsError(LockCompromised  , "The lock has been compromised.");
  });


  it("If `InvalidOptions` has no message but a `param` is specified, the resulting message includes `'param.name'`.", async () => {
    testNoParamsError(InvalidOptions  , "The value of the specified options(PARAM) is invalid.", { name: "PARAM"});
  });
  

  it("If an error occurs in the lock callback, that error can be caught.", async () => {
    let mon: Monitor = { cancelled: false };
    expect.assertions(3);
    try {
      await FileLock.withLock(
        'testKey_8131',
        (monitor: Monitor) => {
          mon = monitor;
          throw new Error("Callback error!");
        }
      );
    }
    catch (err) {
      expect(mon?.cancelled).toBeTruthy();
      expect(err).instanceOf(Error);
      expect(err).toMatchObject({ message: "Callback error!" });
    }

  });

  it("If an error occurs within the reentrant lock callback, that error can be caught.", async () => {
    let mon1: Monitor = { cancelled: false };
    let mon2: Monitor = { cancelled: false };
    expect.assertions(3);
    try {
      await FileLock.withLock(
        'testKey_18465',
        async (monitor1: Monitor) => {
          mon1 = monitor1;
          await FileLock.withLock(
            'testKey_18465',
            (monitor2: Monitor) => {
              mon2 = monitor2;
              throw new Error("Reentrant callback error!");
            },
            { allowReentry: true }
          );
        }
      );
    }
    catch (err) { // EREENTLOCK
      expect(err).instanceOf(Error);;
      expect(mon1).toBe(mon2);
      expect(mon1).toMatchObject({ cancelled: true, reason: 'ECALLBACK', operation: "Re-entrant locking callback.", cause: err});
    }
  });

  it("When an error occurs in the reentrant lock callback(throwing something other than an error).", async () => {
    let mon1: Monitor = { cancelled: false };
    let mon2: Monitor = { cancelled: false };
    expect.assertions(3);
    try {
      await FileLock.withLock(
        'testKey_18465',
        async (monitor1: Monitor) => {
          mon1 = monitor1;
          await FileLock.withLock(
            'testKey_18465',
            (monitor2: Monitor) => {
              mon2 = monitor2;
              throw "Reentrant callback error!";
            },
            { allowReentry: true }
          );
        }
      );
    }
    catch (err) {
      expect(err).contains("Reentrant callback error!");
      expect(mon1).toBe(mon2);
      expect(mon1).toMatchObject({ cancelled: true, reason: 'ECALLBACK', operation: "Re-entrant locking callback.", cause: err});
    }
  });

  it("File read error occurred during reentrant lock processing.", async () => {
    const key = 'testKey_18465x'
    expect.assertions(2);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw Object.assign(new Error("readFileSync error!"), { code: 'ERMOON' }); });

          await FileLock.withLock(
            key,
            (monitor2: Monitor) => { },
            { allowReentry: true }
          );
        }
      );
    }
    catch (err) { // EREENTLOCK
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code: 'ERMOON', 
        message: "Couldn't read the lock file.(readFileSync error!)",
        path: getLockMetaPath(key)
      });
    }
    finally {
      // Since the read operation fails, the contents of the lock file cannot be verified, preventing it from being deleted normally—meaning other locks will perceive it as still locked.
      // Therefore, the file is forcibly deleted here.
      removeLockFiles(key);
    }
  });

  it("File write error occurred during reentrant lock processing.", async () => {
    const key = 'testKey_18465x'
    expect.assertions(2);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });

          await FileLock.withLock(
            key,
            (monitor2: Monitor) => { },
            { allowReentry: true }
          );
        }
      );
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code:     'EWMOON',
        message:  `Couldn't write the lock file.(writeFileSync error!)`,
        path:     getLockMetaPath(key)
      });
    }
  });

  it("File write error occurred during lock processing.", async () => {
    const key = 'testKey_18465xx'
    expect.assertions(2);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 200 }
      );
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      const cause2 = {
        code: "EWMOON",
        message: "writeFileSync error!",
      };
      const cause = {
        code: "EWMOON",
        path: getLockMetaPath(key),
        message: "Couldn't write the lock file.(writeFileSync error!)",
        causes: [cause2, cause2]
      };
      expect(err).toMatchObject({
        code: "EIO",
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [cause, cause],
      });
    }
  });

  async function testWriteAndUnlinkError(key: string, timeoutMs: number, ErrorClass: new(...args: any[]) => Error, matchObj: object) {
    const orgUnlink = fs.unlinkSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw Object.assign(new Error("unlinkSync error!"), { code: 'EUNLINK' }); });
    expect.assertions(2);
    try {
      await FileLock.withLock(
        key,
        (monitor1: Monitor) => {},
        { timeoutMs }
      );
    }
    catch (err) {
      expect(err).instanceOf(ErrorClass);
      console.log("### 1st expect ok! ###");
      expect(err).toMatchObject(matchObj);
      console.log("### 2st expect ok! ###");
    }
    finally {
      // 作りかけのファイルが残っているので、削除する。
      orgUnlink(getLockMetaPath(key));
    }
  }

  it("The generation (writing) of the lock file fails when the preliminary lock is not held, " +
     "and the subsequent attempt to delete the file also fails.(FileLockError)", async () => {
    const key = 'testKey_18465xx_unlink'
    await testWriteAndUnlinkError(key, 50, FileLockError, {
      code: "EIO",
      message: "Failed to acquire the lock due to a file I/O error.",
      path: getLockMetaPath(key),
      causes: [{
        code: "EUNLINK",
        message: "unlinkSync error!",
      }],
    });
    /*
    expect.assertions(2);
    const orgUnlink = fs.unlinkSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw Object.assign(new Error("unlinkSync error!"), { code: 'EUNLINK' }); });
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 50 } // タイムアウトを短くしないとretryLockが走り、空のメタファイルを見つけて、破損エラーになる
      );
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code: "EIO",
        message: "Failed to acquire the lock due to a file I/O error.",
        path: getLockMetaPath(key),
        cause: {
          code: "EUNLINK",
          message: "unlinkSync error!",
        },
      });
    }
    finally {
      // 作りかけのファイルが残っているので、削除する。
      orgUnlink(getLockMetaPath(key));
    }
      */
  });

  it("The generation (writing) of the lock file fails when the preliminary lock is not held, " +
     "and the subsequent attempt to delete the file also fails.(LockFileBroken)", async () => {
    const key = 'testKey_18465xx_unlink_LockFileBroken'
    await testWriteAndUnlinkError(key, 200, LockFileBroken, {
      code: "EBROKEN",
      message: "The contents of the lock file are corrupted, making it impossible to determine the lock status. " +
               "Please verify that the target process does not exist and, if necessary, manually delete the lock file.",
      path: getLockMetaPath(key),
      causes: [{
        code: "EUNLINK",
        message: "unlinkSync error!",
      },
      {
        code: "ECOMPROMISED",
        contents: "",
        key: key,
        path: getLockMetaPath(key),
      }],
    });
  });

  it("`existsSync` returns `true` exactly once, even though the specific file does not exist.", async () => {
    const key = 'testKey_existsSync_error_once'
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation((name: PathLike) => {
      if (name === getLockMetaPath(key)) {
        spy.mockRestore();
        return true;
      }
      return false;
    });

    expect(await FileLock.withLock(
      key,
      async (monitor1: Monitor) => {
        await sleepAsync(200);
        return 'completed';
      },
    )).toBe('completed');

    expect(fs.existsSync(getLockMetaPath(key))).toBeFalsy();
  });

  it("existsSync error occurred during trying lock.", async () => {
    const key = 'testKey_existsSync_error'
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw Object.assign(new Error("existsSync test error!!"),  { code: 'EEXISTSYNC' });
    });

    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          await sleepAsync(100);
          return 'completed';
        },
        { timeoutMs: 200 }
      )
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      const cause2 = {
        code: "EEXISTSYNC",
        message: "existsSync test error!!"
      };
      const cause = {
        code: "EEXISTSYNC",
        message: "Couldn't check the existence of the history file.(existsSync test error!!)",
        path: getHistoryPath(),
        causes: [cause2, cause2],
      };
      expect(err).toMatchObject({
        code: "EIO",
        path: getLockMetaPath(key),
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [cause, cause],
      });
    }
    finally {
      // The file cannot be read even during the unlock process; since the file remains, it is forcibly deleted here.
      //fs.unlinkSync(getLockMetaPath(key));
    }
  });

  it("If the metafile is eroded while executing the callback function after acquiring the lock, its analysis will fail.", async () => {
    const key = 'testKey_18465xx'
    expect.assertions(3);
    const metaPath = getLockMetaPath(key);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          fs.writeFileSync(metaPath, '');
          await sleepAsync(1000);
        }
      );
    }
    catch (err) {
      expect(err).instanceOf(LockCompromised);
      expect(err).toMatchObject( {
        code: 'ECOMPROMISED',
        contents: "",
        path: metaPath,
        key: key,
        message: `The lock(key: ${key}) has been compromised(Couldn't parse the lock file, it is probably broken.).`,
      });
      expect(fs.existsSync(metaPath)).toBeTruthy();
    }
    finally {
      fs.unlinkSync(metaPath);
    }
  });

  it("If a corrupted metafile is encountered, it is possible that the file is still being created; " +
     "consequently, repeated retries should eventually result in a timeout error.", async () => {
    const key = 'testKey_18465xx'

    const metaPath = getLockMetaPath(key);
    fs.writeFileSync(metaPath, '');
    expect.assertions(3);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 200 }
      );
    }
    catch (err) {
      expect(err).instanceOf(LockFileBroken);
      const cause = {
        code: "ECOMPROMISED",
        path: metaPath,
        contents: "",
        key: key,
        ownerId: undefined,
        message: `The lock(key: ${key}) has been compromised(Couldn't parse the lock file, it is probably broken.).`
      };
      expect(err).toMatchObject({
        code: 'EBROKEN',
        message: `The contents of the lock file are corrupted, making it impossible to determine the lock status. ` +
                 `Please verify that the target process does not exist and, if necessary, manually delete the lock file.`,
        path: metaPath,
        causes: [cause, cause, cause]
      })
    }
    finally {
      removeLockFiles(key);
    }
    expect(fs.existsSync(metaPath)).toBeFalsy();
  });

  it("history JSON parsing error", async () => {
    const histPath = getHistoryPath();
    const key = 'testKey_18465xxxx'
    const histBu = histPath + '.bu';

    fs.renameSync(histPath, histBu);
    
    fs.writeFileSync(histPath, '()');

    FileLock.setConfig({ history: true });
    
    expect.assertions(2);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 200 }
      );
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      const cause = {
        code: "EHISTORY",
        history: histPath,
        message: "Failed to parse the history file.",
        causes: [{
          message: "Unexpected token '(', \"()\" is not valid JSON",
        }],
      }
      expect(err).toMatchObject({
        code: "EHISTORY",
        message: "Failed to acquire the lock due to history parsing failure.",
        causes: [cause, cause, cause],
      });
    }
    finally {
      fs.rmSync(histPath);
      fs.renameSync(histBu, histPath);
    }
  });

  // FileLock.onExit
  it("FileLock.onExit", async () => {
    const key = 'OnExitTest';
    let mon: Monitor = { cancelled: false };
    expect.assertions(2);
    try {
      await FileLock.withLock(key, async monitor => {
        mon = monitor;
        await sleepAsync(200);
        FileLock.onExit(2, 'SIGTERM');
        },
        {}
      );
    }
    catch (err) {
      expect(err).toMatchObject({
        code: "ETERM",
        exitReason: {
          code: 2,
          signal: "SIGTERM",
        },
        message: "Forced termination."
      });
        expect(mon).toMatchObject({
        cancelled: true,
        reason: "ETERM",
        cause: {
          code: "ETERM",
          exitReason: {
            code: 2,
            signal: "SIGTERM",
          },
        },
        operation: "Callback or Timer in withLock().",
      })
      console.log(err);
    }
  });

  async function testSpyIO(key: string, targetFn: string, errCond: (counter: number) => boolean, sucsess: boolean, /*spyOn: () => void, */ErrClass: unknown, matchObj: object) {
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() - 100, heartbeatTtlMs: 50, lastHeartbeatAt: Date.now() - 100};
    setLockMeta(key, meta);
    let counter = 0;
    //@ts-ignore
    const original = fs[targetFn];
    //@ts-ignore
    vi.spyOn(fs, targetFn).mockImplementation((...args) => {
      counter++;
      if (errCond(counter)) throw Object.assign(new Error("#####"), { code: "EEXIST"});
      return original(...args);
    });
    const asCounts = sucsess ? 1 : 2;
    expect.assertions(asCounts);
    const ret = "completed."
    try {
      expect(await FileLock.withLock(
        key, 
        async () => {
          await sleepAsync(100);
          return ret;
        },
        { timeoutMs: 200 }
      )).toBe(ret);
    }
    catch (err) {
      expect(err).instanceOf(ErrClass);
      expect(err).toMatchObject(matchObj);
    }
  }

  it("When an invalid lock file exists, an exclusive open attempt fails after the file is deleted. A subsequent lock retry succeeds.", async () => {
    const key = "testKey_staleMeta_reopenFailed_lockOK";
    await testSpyIO(
      key,
      'openSync',
      (counter: number) => counter === 2,
      true, 
      null,
      {}
    );
  });

  it("When an invalid lock file exists, an exclusive open attempt fails after the file is deleted. Subsequently, the lock retry fails.", async () => {
    const key = "testKey_staleMeta_reopenFailed_lockNg"
    await testSpyIO(
      key,
      'openSync',
      (counter: number) => counter >= 2,
      false, 
      FileLockError,
      {
        code: "EIO",
        path: getLockMetaPath(key),
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [{
          code: "ENOENT",
          path: getLockMetaPath(key),
          message: `Couldn't remove the lock file.(ENOENT: no such file or directory, unlink '${getLockMetaPath(key)}')`,
          causes: [{
            code: "ENOENT",
            path: getLockMetaPath(key),
            syscall: "unlink",
          },
          {
            code: "ENOENT",
            path: getLockMetaPath(key),
            syscall: "unlink",
          }],
        }],
      }
    );
  });

  it("Failed to delete an invalid lock file, but subsequently succeeded in acquiring the lock.", async () => {
    const key = "testKey_staleMeta_unlinkFailed_lockOK";
    let counter = 0;
    const original = fs.unlinkSync;
    await testSpyIO(
      key,
      'unlinkSync',
      (counter: number) => counter === 1,
      true, 
      AlreadyLocked,
      {
        code: "ELOCKED",
        path: getLockMetaPath(key),
        key: key,
        message: `Could not lock because the '${key}' is already locked.`
      }
    );
  });

  it("Failed to delete an invalid lock file. Subsequently, locking failed.", async () => {
    const key = "testKey_staleMeta_unlinkFailed_lockNG";
    await testSpyIO(
      key,
      'unlinkSync',
      () => true,
      false, 
      FileLockError,
      {
        code: "EIO",
        path: getLockMetaPath(key),
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [{
          code: "EEXIST",
          path: getLockMetaPath(key),
          message: "Couldn't remove the lock file.(#####)",
          causes: [{
            code: "EEXIST",
            message: "#####",
          },
          {
            code: "EEXIST",
            message: "#####",
          }],
        },
        {
          code: "EEXIST",
          path: getLockMetaPath(key),
          message: "Couldn't remove the lock file.(#####)",
          causes: [{
            code: "EEXIST",
            message: "#####",
          },
          {
            code: "EEXIST",
            message: "#####",
          }],
        }],
      }
    );
  });

  it("Circular deadlock. The one that did not time out first succeeds.", async () => {
    const key1 = "testKey_circular_deadlock_001";
    const key2 = "testKey_circular_deadlock_002";
    const p1 = FileLock.withLock(key1, async () => {
      await FileLock.withLock(key2, async () => {
        },
        { timeoutMs: 100 }
      );
      return 'completed.'
    })
    const p2 = FileLock.withLock(key2, async () => {
      await FileLock.withLock(key1, () => {}, { timeoutMs: 100 });
      return 'completed.'
    })

    const results = await Promise.allSettled([p1, p2]);

    // One of them has resulted in a timeout error (AlreadyLocked).
    expect(results[0].status === 'rejected' || results[1].status === 'rejected').toBeTruthy();
    for(const r of results) {
      if (r.status === 'fulfilled') expect(r.value).toBe('completed.');
      else                          expect(r.reason).instanceOf(AlreadyLocked);
    }

  });
});
