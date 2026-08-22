import { describe, expect, it, vi, type Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { logger, sleepAsync, getLockMeta, setLockMeta, removeLockFiles  } from './FileLockTestCommon.ts';
import { AlreadyLocked, DeadlockDetected, FileLock, LockCompromised, TTLExceeded, type Monitor } from '../src/index';

describe('FileLock', () => {

  it("Forge lock information for the same `key` to trigger a timeout.", async () => {
    const key = "testKey";
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 5*60*1000, heartbeatTimeoutMs:10000, lastHeartbeatAt: Date.now()};
    setLockMeta(key, meta);
    expect.assertions(4);
    try {
      await FileLock.withLock(key, async () => {
          await sleepAsync(500);
        },
        {timeoutSec : 1 }
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
        await sleepAsync(3000);
      },
      {timeoutSec : 1 }
    );
    const b =  FileLock.withLock(key, async () => {
        await sleepAsync(1000);
      },
      {timeoutSec : 1 }
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
      // aを待つ
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
        FileLock.clearCache();

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
    finnalyFn: () => void = () => {}): Promise<void> {

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

    const key = "testKey999", retVal = key;
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
        expect(monitor.cancelled).toBeFalsy();
        // Compromised
        const meta = getLockMeta(key);
        meta.ownerId = crypto.randomUUID();
        setLockMeta(key, meta);
        await sleepAsync(1200);
        expect(monitor.cancelled).toBeTruthy();
        expect(monitor.reason).toBe('ECOMPROMISED');
        callbackCompleted('Completed');
      },
      (err) => {
        expect(err instanceof LockCompromised).toBeTruthy();
        expect(err.code).toBe('ECOMPROMISED');
        expect(err.message.includes("has been compromised.")).toBeTruthy();
      },
      () => removeLockFiles(key)
    );
  });

  it("Intentionally overwriting the lock information file within a reentrant lock callback results " +
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
        expect(err instanceof LockCompromised).toBeTruthy();
        expect(err.code).toBe('ECOMPROMISED');
        expect(err.message.includes("has been compromised.")).toBeTruthy();
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
      (err) => expect(err instanceof TTLExceeded).toBeTruthy()
    );
  });

  it("hogehoge", async () => {
  });
});
