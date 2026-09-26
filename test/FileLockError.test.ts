import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import fs, { PathLike } from 'node:fs';
import path from 'node:path';
import { getHistoryPath, getLockMeta, getLockMetaPath, getLockSharerDir, removeLockFiles, setLockMeta, sleepAsync, TestLock  } from './FileLockTestCommon.ts';
import { AlreadyLocked, FileLockConfig, DeadlockDetected, FileLock, FileLockError, LockDirectoryCreationFailed, 
  LockDirectoryStatFailed, LockError, LockFileBroken, InvalidOptions, LockCompromised, ReleaseFailed, TTLExceeded, type LockMonitor, 
  FileLockOptions} from '../src/index.ts';

let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});

const eMsg = {
  'EBROKEN':  "When checking whether a lock for the same key is already held, " + 
              "the contents of the existing lock file were found to be corrupted, " +
              "making it impossible to determine the lock status. " + 
              "Please verify that the target process does not exist and delete the lock file if necessary."
}

describe('FileLockError', () => {

  it("If you instantiate FileLockError without arguments, the code property becomes 'EFILELOCK'.", () => {
    const err = new FileLockError();
    expect(err).toMatchObject({
      code: 'EFILELOCK'
    });
  });

  it("An error occurs if `key` is not specified.", async () => {
    let key;
    expect.assertions(4);
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
    expect(TestLock.isReleasedState(key as any)).toBeTruthy();
  });

  it("Forge lock for the same `key` to trigger a timeout.", async () => {
    const key = "testKey";
    const meta = {ownerId: "hoge", expirationTime: Date.now() + 5*60*1000, heartbeatTtlMs:10000, lastHeartbeatAt: Date.now()};
    setLockMeta(key, meta);
    expect.assertions(3);
    try {
      await FileLock.withLock(key, async () => {
          await sleepAsync(500);
        },
        {timeoutSec : 0.1 }
      );
    }
    catch (err: any) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: 'ELOCKED',
        key,
        message: `Couldn't acquire the lock because the '${key}' is already locked.`,
      });
      /*
      expect(err.code).toBe('ELOCKED');
      expect(err.key).toBe(key);
      expect(err instanceof AlreadyLocked).toBe(true);
      expect(err.message.includes("Couldn't the lock because the")).toBe(true);
      */
    }
    finally {
      removeLockFiles(key);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
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
    expect.assertions(3);
    try {
      await Promise.all([a, b]);
    }
    catch (err: any) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: 'ELOCKED',
        key,
        message: `Couldn't acquire the lock because the '${key}' is already locked.`,
      });
      /*
      expect(err.code).toBe('ELOCKED');
      expect(err.key).toBe(key);
      expect(err instanceof AlreadyLocked).toBe(true);
      expect(err.message.includes("Couldn't the lock because the")).toBe(true);
      */
    }
    finally {
      try {await a} catch(e) {};
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
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
    expect.assertions(6);
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
    expect(TestLock.isReleasedState(key1)).toBeTruthy();
    expect(TestLock.isReleasedState(key2)).toBeTruthy();
  });

  it("A `DeadlockDetected` error occurs occurs even when the lock instances are different.", async () => {

    const key = "testKey";
    expect.assertions(5);
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
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  // If a lock interruption occurs, wait until the callback completes.
  async function waitCallbackCompletedByCancelled(
    lockFn: (cb: (monitor: LockMonitor)=>Promise<void>) => Promise<void>,
    lockCallback: (monitor: LockMonitor, callbackCompleted: (v: unknown) => void) => Promise<void>,
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
      async (callback:(monitor: LockMonitor)=>Promise<void>) => {
        await FileLock.withLock(
          key, 
          async (monitor: LockMonitor) => await callback(monitor),
          {ttlMs: 2000}
        )
      },
      async (monitor: LockMonitor, callbackCompleted) => {
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
        expect(err).instanceOf(ReleaseFailed);
        expect(err).toMatchObject({
          code: "ERELEASE",
          key,
          path: getLockMetaPath(key),
          sharer: getLockSharerDir(key),
          message: "Processing is interrupted because the lock release or lock counter decrement failed. Additionally, please manually delete any remaining files or directories, such as lock files or shared lock information.",
          causes: [{
            code: "ECOMPROMISED",
            key,
            path: getLockMetaPath(key),
            reason: "[VERIFY] The lock file was overwritten by another lock.",
            message: "The lock was compromised during the locking process.",
          }]
        });
      },
      () => removeLockFiles(key)
    );
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("Intentionally overwriting the lock file within a reentrant lock callback results " +
    "in `LockCompromised` error being thrown.", async () => {

    const key = "testKey_9989";
    expect.assertions(9);

    let completedCallbacks = 0;

    await waitCallbackCompletedByCancelled(
      async (callback:(monitor: LockMonitor)=>Promise<void>) => {
        await FileLock.withLock(
          key,
          async (monitor) => await callback(monitor),
          {ttlMs: 10000}
        );
      },
      async (monitor: LockMonitor, callbackCompleted) => {
        expect(monitor.cancelled).toBeFalsy();
        try {
          await FileLock.withLock(
            key,
            async (monitor2: LockMonitor) => {
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
        expect(err).instanceOf(ReleaseFailed);
        expect(err).toMatchObject({
          code: "ERELEASE",
          message: "Processing is interrupted because the lock release or lock counter decrement failed. Additionally, please manually delete any remaining files or directories, such as lock files or shared lock information.",
          key,
          path: getLockMetaPath(key),
          sharer: getLockSharerDir(key),
          causes: [{
            code: "ECOMPROMISED",
            key,
            path: getLockMetaPath(key),
            reason: "[VERIFY] The lock file was overwritten by another lock.",
            message: "The lock was compromised during the locking process.",
          }],
        })
      },
      () => removeLockFiles(key)
    );
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });
 
  it("`TTLExceeded` error occurs if the callback processing exceeds the TTL setting.", async () => {
    const key = "testKey";
    expect.assertions(5); 
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
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  function testNoParamsError(ErrorClass: new(...args: any[]) => Error, msg?: string | null, param?: {}) {
    const err = new ErrorClass(null, param);
    msg ? expect(err.message).toBe(msg) : expect(err.message).toBe('null');
  }

  it("Instantiating an error class without parameters results in the default message.(TTLExceeded).", async () => {
    testNoParamsError(LockError, null);
  });

  it("Instantiating an error class without parameters results in the default message.(TTLExceeded).", async () => {
    testNoParamsError(TTLExceeded, 'The maximum processing time(options.ttlMs milliseconds) while locked has been exceeded.');
  });

  it("Instantiating an error class without parameters results in the default message.(AlreadyLocked).", async () => {
    testNoParamsError(AlreadyLocked , "Couldn't acquire the lock because the 'key' is already locked.");
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
    testNoParamsError(LockCompromised  , "The lock was compromised during the locking process.");
  });


  it("If `InvalidOptions` has no message but a `param` is specified, the resulting message includes `'param.name'`.", async () => {
    testNoParamsError(InvalidOptions  , "The value of the specified options(PARAM) is invalid.", { name: "PARAM"});
  });
  

  it("If an error occurs in the lock callback, that error can be caught.", async () => {
    const key = 'testKey_8131'
    let mon: LockMonitor = { cancelled: false };
    expect.assertions(4);
    try {
      await FileLock.withLock(
        key,
        (monitor: LockMonitor) => {
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
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("If an error occurs within the reentrant lock callback, that error can be caught.", async () => {
    const key = 'testKey_18465';
    let mon1: LockMonitor = { cancelled: false };
    let mon2: LockMonitor = { cancelled: false };
    expect.assertions(4);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          mon1 = monitor1;
          await FileLock.withLock(
            key,
            (monitor2: LockMonitor) => {
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
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("When an error occurs in the reentrant lock callback(throwing something other than an error).", async () => {
    const key = 'testKey_18465_hoge'
    let mon1: LockMonitor = { cancelled: false };
    let mon2: LockMonitor = { cancelled: false };
    expect.assertions(4);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          mon1 = monitor1;
          await FileLock.withLock(
            key,
            (monitor2: LockMonitor) => {
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
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("File read error occurred during reentrant lock processing.", async () => {
    const key = 'testKey_18465x'
    expect.assertions(3);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw Object.assign(new Error("readFileSync error!"), { code: 'ERMOON' }); });

          await FileLock.withLock(
            key,
            (monitor2: LockMonitor) => { },
            { allowReentry: true }
          );
        }
      );
    }
    catch (err) { // EREENTLOCK
      expect(err).instanceOf(ReleaseFailed);
      expect(err).toMatchObject({
        code: "ERELEASE", 
        key,
        message: "Processing is interrupted because the lock release or lock counter decrement failed. Additionally, please manually delete any remaining files or directories, such as lock files or shared lock information.",
        path: getLockMetaPath(key),
        sharer: getLockSharerDir(key),
        causes: [{
          code: "ERMOON",
          path: getLockMetaPath(key),
          message: "Couldn't read the lock file.(readFileSync error!)",
        }],
      });
    }
    finally {
      // Since the read operation fails, the contents of the lock file cannot be verified, preventing it from being deleted normally—meaning other locks will perceive it as still locked.
      // Therefore, the file is forcibly deleted here.
      removeLockFiles(key);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("File write error occurred during reentrant lock processing.", async () => {
    const key = 'testKey_18465x'
    expect.assertions(3);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });

          await FileLock.withLock(
            key,
            (monitor2: LockMonitor) => { },
            { allowReentry: true }
          );
        }
      );
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code:     "EIO",
        key,
        message:  "Failed to add the lock request to lock sharers.",
        causes: [{
          code: "EWMOON",
          //path: getLockSharerDir(key) + xxxxx,
          message: "Couldn't write the lock file.(writeFileSync error!)",
        }],
      });
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("File write error occurred during lock processing.", async () => {
    const key = 'testKey_18465xx'
    expect.assertions(3);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 150 }
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
        causes: [cause],
      });
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  async function testWriteAndUnlinkError(key: string, timeoutMs: number, ErrorClass: new(...args: any[]) => Error, matchObj: object) {
    const orgUnlink = fs.unlinkSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw Object.assign(new Error("unlinkSync error!"), { code: 'EUNLINK' }); });
    expect.assertions(3);
    try {
      await FileLock.withLock(
        key,
        (monitor1: LockMonitor) => {},
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
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  }

  it("The generation (writing) of the lock file fails when the preliminary lock is not held, " +
     "and the subsequent attempt to delete the empty file also fails.(FileLockError)", async () => {
    const key = 'testKey_18465xx_unlink'
    await testWriteAndUnlinkError(key, 50, FileLockError, {
      code: "EIO",
      message: "Failed to acquire the lock due to a file I/O error.",
      key,
      causes: [{
        code: "EUNLINK",
        path: getLockMetaPath(key),
        message: "Couldn't remove the lock file.(unlinkSync error!)",
        causes: [{
          code: "EUNLINK",
          message: "unlinkSync error!",
        }, {
          code: "EUNLINK",
          message: "unlinkSync error!",
        }],
      }],
    });
    //expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("The generation (writing) of the lock file fails when the preliminary lock is not held, " +
     "and the subsequent attempt to delete the empty file also fails.(LockFileBroken)", async () => {
    const key = 'testKey_18465xx_unlink_LockFileBroken'
    await testWriteAndUnlinkError(key, 500, LockFileBroken, {
      code: "EBROKEN",
      message: eMsg['EBROKEN'],
      path: getLockMetaPath(key),
      causes: [{
        code: "EUNLINK",
        path: getLockMetaPath(key),
        message: "Couldn't remove the lock file.(unlinkSync error!)",
        causes: [{
          code: "EUNLINK",
          message: "unlinkSync error!",
        }, {
          code: "EUNLINK",
          message: "unlinkSync error!",
        }]
      },
      /*{
        code: "ECOMPROMISED",
        contents: "",
        key: key,
        path: getLockMetaPath(key),
      }*/],
    });
    //expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  // ★　このテストはもはや意味が無い？？もしくは、カバレッジ対策のテストなのか！！。。代わりに、"ロックファイルがあるのに無いと偽る"テストを追加する
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
      async (monitor1: LockMonitor) => {
        await sleepAsync(200);
        return 'completed';
      },
    )).toBe('completed');

    //expect(fs.existsSync(getLockMetaPath(key))).toBeFalsy();
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("existsSync error occurred during trying lock.", async () => {
    const key = 'testKey_existsSync_error'
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw Object.assign(new Error("existsSync test error!!"),  { code: 'EEXISTSYNC' });
    });

    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          await sleepAsync(100);
          return 'completed';
        },
        { timeoutMs: 150 }
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
        message: "check the existence of the lock file.(existsSync test error!!)",
        path: getLockSharerDir(key),
        causes: [cause2, cause2],
      };

      expect(err).toMatchObject({
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [cause],
      });
    }
    finally {
      // 以下でIO操作するので、ここでリセット。
      vi.restoreAllMocks();
      removeLockFiles(key);
      expect(TestLock.isReleasedState(key)).toBeTruthy();
    }
  });

  it("If the metafile is eroded while executing the callback function after acquiring the lock, its analysis will fail.", async () => {
    const key = 'testKey_18465xx'
    expect.assertions(4);
    const metaPath = getLockMetaPath(key);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          fs.writeFileSync(metaPath, '');
          await sleepAsync(1100);
          await sleepAsync(100);
        }
      );
    }
    catch (err) {
      expect(err).instanceOf(ReleaseFailed);
      expect(err).toMatchObject( {
        code: "ERELEASE",
        path: metaPath,
        sharer: getLockSharerDir(key),
        key,
        message: "Processing is interrupted because the lock release or lock counter decrement failed. " +
                 "Additionally, please manually delete any remaining files or directories, " + 
                 "such as lock files or shared lock information.",
      });
      expect(fs.existsSync(metaPath)).toBeTruthy();
    }
    finally {
      //fs.unlinkSync(metaPath);
      removeLockFiles(key);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
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
        async (monitor1: LockMonitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 150 }
      );
    }
    catch (err) {
      expect(err).instanceOf(LockFileBroken);
      /*const cause = {
        code: "ECOMPROMISED",
        path: metaPath,
        contents: "",
        key,
        ownerId: undefined,
        reason: "Couldn't parse the lock file, it is probably broken.",
        message: "The lock was compromised during the locking process."
      };*/
      const msg = eMsg['EBROKEN'];
      expect(err).toMatchObject({
        code: 'EBROKEN',
        message: msg,
        path: metaPath,
        //causes: [cause]
      })
    }
    finally {
      removeLockFiles(key);
    }
    //expect(fs.existsSync(metaPath)).toBeFalsy();
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("history JSON parsing error", async () => {
    const histPath = getHistoryPath();
    const key = 'testKey_18465xxxx'
    const histBu = histPath + '.bu';

    fs.renameSync(histPath, histBu);
    
    fs.writeFileSync(histPath, '()');

    FileLock.setConfig({ history: true });
    
    expect.assertions(3);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: LockMonitor) => {
          await sleepAsync(100);
        },
        { timeoutMs: 150 }
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
        causes: [cause, cause],
      });
    }
    finally {
      fs.rmSync(histPath);
      fs.renameSync(histBu, histPath);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  // FileLock.onExit
  it("FileLock.onExit", async () => {
    const key = 'OnExitTest';
    let mon: LockMonitor = { cancelled: false };
    expect.assertions(3);
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
        reason: {
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
          reason: {
            code: 2,
            signal: "SIGTERM",
          },
        },
        operation: "Callback or Timer in withLock().",
      })
      console.log(err);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  // 不正ロックファイルを故意に作成し、ファイルIOエラーを故意に引き起こすテスト
  async function testSpyIO(
    key: string, 
    targetFn: string, 
    spyCb: (counter: number, args: unknown[], orgFn: (...args: unknown[]) => any) => any, 
    sucsess: boolean, 
    ErrClass: unknown, 
    matchObj: object,
    sweep = false,
    meta: Record<string, unknown> = {ownerId: "hoge", expirationTime: Date.now() - 100, heartbeatTtlMs: 50, lastHeartbeatAt: Date.now() - 100},
    ) {

      if (meta) setLockMeta(key, meta);

    let counter = 0;
    //@ts-ignore
    const original = fs[targetFn];
    //@ts-ignore
    const spy = vi.spyOn(fs, targetFn).mockImplementation((...args) => {
      counter++;
      return spyCb(counter, args, original);
      //if (errCond(counter)) throw Object.assign(new Error("#####"), { code: "EEXIST"});
      //return original(...args);
    });

    const asCounts = (sucsess ? 1 : 2) + 1;
    expect.assertions(asCounts);
    const ret = "completed."
    try {
      expect(await FileLock.withLock(
        key, 
        async () => {
          await sleepAsync(100);
          return ret;
        },
        { timeoutMs: 0 } // ロック取得リトライ回数を0にするため、0msとする
      )).toBe(ret);
    }
    catch (err) {
      expect(err).instanceOf(ErrClass);
      expect(err).toMatchObject(matchObj);
    }
    finally {
      spy.mockRestore()
      if (sweep) removeLockFiles(key);
      expect(TestLock.isReleasedState(key)).toBeTruthy();
    }
  }

  it("When an invalid lock file exists, an exclusive open attempt fails after the file is deleted. A subsequent lock succeeds.", async () => {
    const key = "testKey_staleMeta_reopenFailed_lockOK";
    await testSpyIO(
      key,
      'openSync',
      (counter, args, orgFn) => {
        if (counter === 2) throw Object.assign(new Error("#####"), { code: "EEXIST"});
        return orgFn(...args);
      },
      true, 
      null,
      {}
    );
  });

  it("When an invalid lock file exists, an exclusive open attempt fails after the file is deleted. Subsequently, the lock fails.", async () => {
    const key = "testKey_staleMeta_reopenFailed_lockNg"
    await testSpyIO(
      key,
      'openSync',
      (counter, args, orgFn) => {
        if (counter >= 2) throw Object.assign(new Error("#####"), { code: "EEXIST"});
        return orgFn(...args);
      },
      false, 
      AlreadyLocked,
      {
        code: "ELOCKED",
        key,
        path: getLockMetaPath(key),
        message: `Couldn't acquire the lock because the '${key}' is already locked.`,
      }
    );
  });

  it("Failed to delete an invalid lock file, but subsequently succeeded in acquiring the lock.", async () => {
    const key = "testKey_staleMeta_unlinkFailed_lockOK";

    await testSpyIO(
      key,
      'unlinkSync',
      //(counter: number) => counter === 1,
      (counter, args, orgFn) => {
        if (counter === 1) throw Object.assign(new Error("#####"), { code: "EEXIST"});
        return orgFn(...args);
      },
      true, 
      AlreadyLocked,
      {
        code: "ELOCKED",
        path: getLockMetaPath(key),
        key: key,
        message: `Couldn't the lock because the '${key}' is already locked.`
      }
    );
  });

  it("Failed to delete an invalid lock file. Subsequently, locking failed.", async () => {
    const key = "testKey_staleMeta_unlinkFailed_lockNG";
    const cause = {
      code: "EEXIST",
      path: getLockMetaPath(key),
      message: "Couldn't remove the lock file.(#####)",
      causes: [{ // IOError時リトライ回数に依存して個数が繰り返される（デフォルトは1なので、２回分格納されている）
        code: "EEXIST",
        message: "#####",
      },
      {
        code: "EEXIST",
        message: "#####",
      }],
    };

    await testSpyIO(
      key,
      'unlinkSync',
      (counter, args, orgFn) => {
        throw Object.assign(new Error("#####"), { code: "EEXIST"});
      },
      false, 
      FileLockError,
      {
        code: "EIO",
        message: "Failed to acquire the lock due to a file I/O error.",
        key,
        causes: [cause], 
      },
      true
    );
  });

  it("ロック共有ディレクトリのロックがかかった状態を故意につくってロックを掛ける", async () => {
    const key = "testKey_sharer_lock";
    await testSpyIO(
      key,
      'openSync',
      (counter, args, orgFn) => {
      if (String(args[0]).includes(".sharer\\.lock") ) throw Object.assign(new Error("openSync error!"), { code: 'EOMOON' });
      return orgFn(...args);
      },
      false, // error
      FileLockError,
      {
        code: 'EIO',
        message: "Failed to acquire the lock due to a file I/O error.",
        key,
        causes: [{
          code: 'EIO',
          key,
          message: "Failed to add the lock request to lock sharers.",
          causes: [{
            code: "EOMOON",
            path: path.join(getLockSharerDir(key), ".lock"),
            message: "Couldn't create the file.(openSync error!)",
          }]
        }],
      },
      false, // sweep
      undefined,
    );

  });

  it("ロック共有者の削除失敗", async () => {
    const key = 'lock_sharer_remove_fail';
    await testSpyIO(
      key,
      'unlinkSync',
      (counter, args, orgFn) => {
      if (String(args[0]).toString().includes(".sharer\\.lock") ) throw Object.assign(new Error("unlinkSync error!"), { code: 'EULMOON' });
      return orgFn(...args);
      },
      false, // error
      FileLockError,
      {
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [{
          code: "EIO",
          key,
          message: "Failed to add the lock request to lock sharers.",
          causes: [{
            code: 'EULMOON',
            path: path.join(getLockSharerDir(key), '.lock'),
            message: "Couldn't remove the lock file.(unlinkSync error!)",
            causes: [
              { code: 'EULMOON', message: "unlinkSync error!" },
              { code: 'EULMOON', message: "unlinkSync error!" }
            ]
          }],
        }],
      },
      true, // sweep
      undefined,
    );

  });

  it("ロック共有者のリスト取得失敗", async () => {
    const key = 'Key_readdirSyncErr';
    let targetPath: string = getLockSharerDir(key);
    const cause2 = {
      code: 'ERDMOON',
      path: targetPath,
      message: "Couldn't read the direcroty.(readdirSync error)",
    };
    const cause = {
          code: 'EIO',
          key,
          message: "Failed to count the lock sharer.",
          causes: [cause2]
    };

    await testSpyIO(
      key,
      'readdirSync',
      (counter, args, orgFn) => {
        if (targetPath === args[0]) throw Object.assign(new Error('readdirSync error'), { code: 'ERDMOON' });
        return orgFn(...args);
      },
      false, // error
      ReleaseFailed,
      {
        code: "ERELEASE",
        key,
        path: getLockMetaPath(key),
        sharer: targetPath,
        causes: [cause]
      },
      true, // sweep
      undefined,
    );
  });

  //removeSharer unlinkSync
  it("ロック共有者削除エラー", async () => {
    const key = 'Key_unlinkSyncErr';
    const targetDir: string = getLockSharerDir(key);
    let targetPath: string = '';

    const cause2 = {
      code: 'EULMOON',
      message: "Couldn't remove the lock file.(unlinkSync error)",
    };
    const cause = {
          code: 'EIO',
          key,
          message: "Failed to remove the lock request from the lock sharers.",
          causes: [cause2]
    };

    await testSpyIO(
      key,
      'unlinkSync',
      (counter, args, orgFn) => {
        if (String(args[0]).includes(targetDir) === true && String(args[0]).includes(targetDir + '\\.lock') === false) {
          targetPath = String(args[0]);
          throw Object.assign(new Error('unlinkSync error'), { code: 'EULMOON' });
        }
        return orgFn(...args);
      },
      false, // error
      ReleaseFailed,
      {
        code: "ERELEASE",
        key,
        path: getLockMetaPath(key),
        sharer: getLockSharerDir(key),
        message: "Processing is interrupted because the lock release or lock counter decrement failed. " +
                 "Additionally, please manually delete any remaining files or directories, " +
                 "such as lock files or shared lock information.",
        causes: [cause]
      },
      true, // sweep
      undefined,
    );
  });

  it("ロックファイルがあるのに無いと偽る", async () => {
    const key = 'Key_existsSync_false';
    const targetPath = getLockMetaPath(key);

    await testSpyIO(
      key,
      'existsSync',
      (counter, args, orgFn) => {
        if (String(args[0]) == targetPath) return false;
        return orgFn(...args);
      },
      false, // error
      LockFileBroken,
      {
        code: "EBROKEN",
        path: targetPath,
        message: "When checking whether a lock for the same key is already held, the contents of the existing lock file were found to be corrupted, making it impossible to determine the lock status. Please verify that the target process does not exist and delete the lock file if necessary.",
      },
      true, // sweep
      undefined,
    );

  });

  it("前段ロックファイルがあるので、排他オープンに失敗するが、そのファイルの存在を確認すると、無いと言われる。", async () => {
    const key = 'Key_existsSync_false';
    const targetPath = getLockMetaPath(key);

    await testSpyIO(
      key,
      'existsSync',
      (counter, args, orgFn) => {
        if (String(args[0]) == targetPath) return false;
        return orgFn(...args);
      },
      false, 
      LockFileBroken,
      {
        code: "EBROKEN",
        path: targetPath,
        message: "When checking whether a lock for the same key is already held, the contents of the existing lock file were found to be corrupted, making it impossible to determine the lock status. Please verify that the target process does not exist and delete the lock file if necessary.",
      },
      true,
      {ownerId: "hoge", expirationTime: Date.now(), heartbeatTtlMs:25000, lastHeartbeatAt: Date.now() - 3000},
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
    expect(TestLock.isReleasedState(key1)).toBeTruthy();
    expect(TestLock.isReleasedState(key2)).toBeTruthy();
  });

  it("不正なロックファイルを故意に作成し、エラーとなることを確認する", async () => {
    const key = "invald_loclfile_error";
    const meta = {};
    setLockMeta(key, meta);
    expect.assertions(3);
    try {
      await FileLock.withLock(key, () => {}, { heartbeatTtlMs: 200, timeoutMs: 300 });
    }
    catch (err) {
      expect(err).instanceOf(LockFileBroken);
      expect(err).toMatchObject({
        code: "EBROKEN",
        path: getLockMetaPath(key),
        message: "When checking whether a lock for the same key is already held, the contents of the existing lock file were found to be corrupted, making it impossible to determine the lock status. Please verify that the target process does not exist and delete the lock file if necessary."
      });
    }
    finally {
      removeLockFiles(key);
      expect(TestLock.isReleasedState(key)).toBeTruthy();
    }
  });

});

