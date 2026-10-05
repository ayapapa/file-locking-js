import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { getLockMeta, getLockMetaPath, removeLockFiles, setLockMeta, sleepAsync, TestLock  } from './FileLockTestCommon.ts';
import { AlreadyLocked, type FileLockConfig, DeadlockDetected, FileLock, FileLockError, LockDirectoryCreationFailed, 
  LockDirectoryStatFailed, LockError, InvalidOptions, LockCompromised, ReleaseFailed, TTLExceeded, type LockMonitor } from '../src/index.ts';

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
    const err = new FileLockError("");
    expect(err).toMatchObject({
      code: 'EFILELOCK'
    });
  });

  it("An error occurs if `key` is not specified.", async () => {
    expect.assertions(3);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await FileLock.withLock(undefined as any, async () => {
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
    catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: 'EALREADYLOCKED',
        key,
        reason: "ExistingLock",
        message: `Lock file already exists.`,
      });
      /*
      expect(err.code).toBe('EALREADYLOCKED');
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
        await sleepAsync(500);
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
    catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: 'EALREADYLOCKED',
        key,
        reason: "ExistingLock",
        message: `Lock file already exists.`,
      });
      /*
      expect(err.code).toBe('EALREADYLOCKED');
      expect(err.key).toBe(key);
      expect(err instanceof AlreadyLocked).toBe(true);
      expect(err.message.includes("Couldn't the lock because the")).toBe(true);
      */
    }
    finally {
      try {await a} catch(e) {;/* do nothing*/};
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("Calling `withLock` with the same key inside a callback function "+
    "that is already holding the lock results in a deadlock error.", async () => {

    const key = "testKey";
    expect.assertions(3);
    try {
      await FileLock.withLock(key, async () => {
        await FileLock.withLock(key, async () => {
          await sleepAsync(500);
        });
      });
    } catch (err) {
      expect(err).toMatchObject({
        code: 'EDEADLK',
        key,
      });
      expect(err).instanceOf(DeadlockDetected);
      expect(err instanceof Error && err.message.includes("A deadlock was detected.")).toBe(true);
    }
  });

  it("With three-level lock nesting, `DeadlockDetected` error occurs when the first and third locks target the same key.", async () => {
 
    const key1 = "testKey_10000", key2 = 'testKey_20000';
    expect.assertions(5);
    try {
      await FileLock.withLock(key1, async () => {
        await FileLock.withLock(key2, async () => {
          await FileLock.withLock(key1, async () => {
            await sleepAsync(500);
          });
        });
      });
    } catch (err) {
      expect(err).toMatchObject({
        code: 'EDEADLK',
        key: key1,
      });
      expect(err).instanceOf(DeadlockDetected);
      expect(err instanceof Error && err.message.includes("A deadlock was detected.")).toBe(true);
    }
    expect(TestLock.isReleasedState(key1)).toBeTruthy();
    expect(TestLock.isReleasedState(key2)).toBeTruthy();
  });

  it("A `DeadlockDetected` error occurs occurs even when the lock instances are different.", async () => {

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
    }
    catch (err) {
      expect(err).toMatchObject({
        code: 'EDEADLK',
        key,
      });
      expect(err).instanceOf(DeadlockDetected);
      expect(err instanceof Error && err.message.includes("A deadlock was detected.")).toBe(true);
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  // If a lock interruption occurs, wait until the callback completes.
  async function waitCallbackCompletedByCancelled(
    lockFn: (cb: (monitor: LockMonitor)=>Promise<void>) => Promise<void>,
    lockCallback: (monitor: LockMonitor, callbackCompleted: (v: unknown) => void) => Promise<void>,
    errorFn: (err: unknown) => void,
    finalyFn: () => void = () => {}
  ): Promise<unknown> {

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
      finalyFn();
    }
    return callbackPromise;
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
          message: "Processing is interrupted because the lock release or lock counter decrement failed.",
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
          //await sleepAsync(2000);
        }
        finally {
          expect(monitor.cancelled).toBeTruthy();
          expect(monitor.reason).toBe('ECOMPROMISED');
          if (++completedCallbacks >= 2) callbackCompleted('Completed.');
        }
      },
      (err) => {
        expect(err).instanceOf(LockCompromised);
        expect(err).toMatchObject({
          code: "ECOMPROMISED",
          message: "The lock was compromised during the locking process.",
          key,
          path: getLockMetaPath(key),
          //sharer: getLockSharerDir(key),
          reason: "[VERIFY] The lock file was overwritten by another lock.",
          /*causes: [{
            code: "ECOMPROMISED",
            key,
            path: getLockMetaPath(key),
            reason: "[VERIFY] The lock file was overwritten by another lock.",
            message: "The lock was compromised during the locking process.",
          }],
          */
        })
      },
      () => removeLockFiles(key)
    );
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });
 
  it("`TTLExceeded` error occurs if the callback processing exceeds the TTL setting.", async () => {
    const key = "testKey";
    const options = {ttlMs: 1000};
    expect.assertions(6); 
    await waitCallbackCompletedByCancelled(
      async (callback) => {
        await FileLock.withLock(
          key,
          async (monitor) => await callback(monitor),
          options
        )
      },
      async (monitor, callbackCompleted) => {
        expect(monitor.cancelled).toBeFalsy();
        await sleepAsync(1000);
        expect(monitor.cancelled).toBeTruthy();
        expect(monitor.reason).toBe('ETTLEXCEEDED');
        callbackCompleted('Completed.')
      },
      (err) => {
        expect(err).instanceOf(TTLExceeded);
        expect(err).toMatchObject({
          code: "ETTLEXCEEDED",
          message: `The maximum processing time(${options.ttlMs} milliseconds) while locked has been exceeded.`,
        })
      }
    );
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  function testNoParamsError(ErrorClass: new(...args: any[]) => Error, msg?: string | null, param?: Record<string, unknown>) {
    const err = new ErrorClass(null, param);
    expect(err.message).toBe(msg)
    //if (msg) expect(err.message).toBe(msg)
    //else expect(err.message).toBe(null);
  }

  it("Instantiating an error class without parameters results in the default message.(LockError).", () => {
    testNoParamsError(LockError, null);
  });

  it("Instantiating an error class without parameters results in the default message.(TTLExceeded).", () => {
    testNoParamsError(TTLExceeded, 'The maximum processing time(options.ttlMs milliseconds) while locked has been exceeded.');
  });

  it("Instantiating an error class without parameters results in the default message.(AlreadyLocked).", () => {
    testNoParamsError(AlreadyLocked , "Couldn't acquire the lock because the 'key' is already locked.");
  });

  it("Instantiating an error class without parameters results in the default message.(InvalidOptions).", () => {
    testNoParamsError(InvalidOptions  , "The value of the specified options is invalid.");
  });
  
  it("Instantiating an error class without parameters results in the default message.(DeadlockDetected).", () => {
    testNoParamsError(DeadlockDetected  , "A deadlock was detected.");
  });

  //LockDirectoryAccessFailed 
  it("Instantiating an error class without parameters results in the default message.(LockDirectoryStatFailed).", () => {
    testNoParamsError(LockDirectoryStatFailed  , "Failed to check the status of the lock directory.");
  });

  it("Instantiating an error class without parameters results in the default message.(LockDirectoryCreationFailed).", () => {
    testNoParamsError(LockDirectoryCreationFailed  , "Failed to create the lock directory.");
  });

  //LockCompromised 
  it("Instantiating an error class without parameters results in the default message.(LockCompromised).", () => {
    testNoParamsError(LockCompromised  , "The lock was compromised during the locking process.");
  });


  it("If `InvalidOptions` has no message but a `param` is specified, the resulting message includes `'param.name'`.", () => {
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
        async () => {
          vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw Object.assign(new Error("readFileSync error!"), { code: 'ERMOON' }); });

          await FileLock.withLock(
            key,
            () => { },
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
        message: "Processing is interrupted because the lock release or lock counter decrement failed.",
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
        async () => {
          vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });

          await FileLock.withLock(
            key,
            () => { },
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
        async () => {
          await sleepAsync(100);
        },
        { timeoutMs: 50 }
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
        path: getLockMetaPath(key) + '.tmp',
        message: "Failed to write the temporary `lock file`.(writeFileSync error!)",
        causes: [cause2]
      };
      expect(err).toMatchObject({
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [cause],
      });
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });
});

