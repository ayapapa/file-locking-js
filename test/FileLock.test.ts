import { describe, expect, it, vi, type Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { Config, AlreadyLocked, DeadlockDetected, FileLock, FileLockError, 
  FileLockUserOptions, LogProvider, LockCompromised, LockDirectoryCreationFailed, 
  LockDirectoryStatFailed, TTLExceeded, type Monitor } from '../src/index';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';
import { finalization } from 'node:process';
//import { AlreadyLocked, DeadlockDetected } from '../src/lib/LockErrors.ts';
//import { LockCompromised } from '../src/lib/FileLockErrors.ts';


async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const logger = new PrettyConsole({ level: 'trace' });

FileLock.setConfig({ logger, ErrorStackTraceLimit: 20 });

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

  it("The reentrancy context is shared even when the lock instances are different.", async () => {
    const als = (LockBase as any).als;
    const rc: ReentrantContext = als.getStore();
    const childContext: ReentrantContext = { heldLocks: new Map(rc?.heldLocks) };
    const contextId = 'text-context';
    childContext.heldLocks.set(contextId, { monitor: { cancelled: false } });
    als.run(childContext, async () => {
      const key1 = 'testKey1', key2 = 'testKey2';
      const ins1 = (FileLock as any).getLock(key1) as LockBase as any;
      const ins2 = (FileLock as any).getLock(key2) as LockBase as any;
      expect(ins1 !== ins2).toBe(true);
      expect(ins1.getReentrantContext().heldLocks.has(contextId)).toBe(true);
      expect(ins2.getReentrantContext().heldLocks.has(contextId)).toBe(true);
    });
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

  function getLockMetaPath(key: string): string {
    return path.join((FileLock as any).getLockDirPath(), key + '.json');
  }

  const getLockMeta = (key: string) => {
    const lockMetaPath = getLockMetaPath(key);
    const contents: string = fs.readFileSync(lockMetaPath, 'utf8');
    return JSON.parse(contents);
  };

  const setLockMeta = (key: string, meta: any) => {
    const lockMetaPath = getLockMetaPath(key);
    fs.mkdirSync(path.dirname(lockMetaPath), {recursive: true});
    fs.writeFileSync(lockMetaPath, JSON.stringify(meta));
  };
  
  function removeLockFiles(key: string) {
    const lockMetaPath = getLockMetaPath(key);
    //const lockfileDirPath = getLockfilePath(key);
    if (fs.existsSync(lockMetaPath)) fs.rmSync(lockMetaPath);
    //if (fs.existsSync(lockfileDirPath)) fs.rmSync(lockfileDirPath, {recursive:true, force: true});
  }

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
/*
    let callbackCompleted: (v: unknown) => void;
    const callbackPromise = new Promise(resolve => {
      callbackCompleted = resolve;
    });
    try {
      await FileLock.withLock(
        key,
        async (monitor: Monitor) => {
          try {
            await FileLock.withLock(
              key,
              async (monitor2: Monitor) => {

                // Compromised
                const meta = getLockMeta(key);
                meta.ownerId = crypto.randomUUID();
                setLockMeta(key, meta);

                await sleepAsync(1100);
                // callbackCompleted();// ここは到達するが、ここで解決すると、呼んだ側の処理の途中で終わってしまう。
              },
              {ttlMs: 2000, allowReentry: true}
            );
            // ここに到達しない、
            await sleepAsync(2000);
          }
          catch (err) {
            throw err;         
          }
          finally {
            // ここで、プロミスを完了させる
            callbackCompleted('Completed.');// でも、こない。。ので、何時まで経ってもresolveされない
          }
        },
        {ttlMs: 10000}
      );
    } catch (err: any) {
      expect(err instanceof LockCompromised).toBeTruthy();
      expect(err.code).toBe('ECOMPROMISED');
      expect(err.message.includes("has been compromised.")).toBeTruthy();
    }
    finally {
      removeLockFiles(key);
    }
    await callbackPromise;
*/      
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

  async function testIeinvalidLocknformationFile(target: string, v?: any ) {
    const key = "testKey";
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 10*1000, heartbeatTimeoutMs:5000, lastHeartbeatAt: Date.now()};
    const mt = {...meta} as any;
    if (v) {
      mt[target] = v;
    } else {
      delete mt[target];
    }
    setLockMeta(key, mt);
    try {
      await FileLock.withLock(
        key,
        async () => await sleepAsync(500),
        {ttlMs: 1000}
      );
    } catch (err: any) {
      expect(err instanceof LockCompromised).toBeTruthy();
      expect(err.code).toBe('ECOMPROMISED');
      expect(err.message.includes('has been compromised')).toBeTruthy();
    }
    finally {
      removeLockFiles(key);
    }
  }

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No ownerId)", async () => {
    await testIeinvalidLocknformationFile("ownerId");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testIeinvalidLocknformationFile("counter");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testIeinvalidLocknformationFile("expirationTime");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTimeoutMs)", async () => {
    await testIeinvalidLocknformationFile("heartbeatTimeoutMs");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(Invalid ownerId)", async () => {
    await testIeinvalidLocknformationFile("ownerId", 12345);
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No counter)", async () => {
    await testIeinvalidLocknformationFile("counter", 'hogehogehoge');
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No expirationTime)", async () => {
    await testIeinvalidLocknformationFile("expirationTime", "nyannnyann");
  });

  it("Spoof the invalid lock information storage file and verify that an error occurs.(No heartbeatTimeoutMs)", async () => {
    await testIeinvalidLocknformationFile("heartbeatTimeoutMs", "miimii");
  });



  /**
   * "Intentionally overwriting the lock information..." テストにて発覚：
   *  再入ロック許容時のエラー処理が不十分だったこえおｔ⇒　手当はしたが、リファクタリングが必要
   *  ↑の教訓として、finally処理(アンロック処理実行)におても、エラーが発生することが確認できた！　全部見直せ！！！
   * 　↑　対応でよいのか、そもそもdecXXXCounterの中に閉じ込めるべきなのか、、、、
  */

  it("hogehoge", async () => {
  });

});
