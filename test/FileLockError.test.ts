import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import fs, { PathLike, rmSync } from 'node:fs';
import path from 'node:path';
import { getHistoryPath, getLockMeta, getLockMetaPath, removeLockFiles, setLockMeta, sleepAsync  } from './FileLockTestCommon.ts';
import { AlreadyLocked, FileLockConfig, DeadlockDetected, FileLock, FileLockError, LockDirectoryCreationFailed, 
  LockDirectoryStatFailed, LockError, LockFileBroken, InvalidOptions, LockCompromised, TTLExceeded, type Monitor } from '../src/index.ts';
import { finalization } from 'node:process';

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('FileLock', () => {

  it("引数なしでFileLockErrorをnewすると、codeプロパティが'EFILELOCK'となる", () => {
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

  it("Forge lock information for the same `key` to trigger a timeout.", async () => {
    const key = "testKey";
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() + 5*60*1000, heartbeatTimeoutMs:10000, lastHeartbeatAt: Date.now()};
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
        try {
          expect(monitor.cancelled).toBeFalsy();
          // Compromised
          const meta = getLockMeta(key);
          meta.ownerId = crypto.randomUUID();
          setLockMeta(key, meta);
          // ハートビートでエラーになるので、最低でも１秒は待つ。
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
    testNoParamsError(LockDirectoryStatFailed  , "Failed to check the status of the lock information directory.");
  });

  it("Instantiating an error class without parameters results in the default message.(LockDirectoryCreationFailed).", async () => {
    testNoParamsError(LockDirectoryCreationFailed  , "Failed to create the lock information directory.");
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

  // ロックキーディレクトリ方式はやめたので、このテストは不要
  /*
  it("mkdir error occurred during reentrant lock processing.", async () => {
    const key = 'testKey_mkdir_error'
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { throw Object.assign(new Error("mkdirSync error!"), { code: 'EMKDIR' }); });
    expect.assertions(2);
    try {
      await FileLock.withLock(
        key,
        async (monitor1: Monitor) => {
          await sleepAsync(200);
        },
        { timeoutMs: 100 }
      );
    }
    catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: "ELOCKED", 
        key: "testKey_mkdir_error",
        message: "Could not lock because the 'testKey_mkdir_error' is already locked.",
        file: getLockMetaPath(key)
      });
    }
    finally {
      // Since the read operation fails, the contents of the lock information file cannot be verified, preventing it from being deleted normally—meaning other locks will perceive it as still locked.
      // Therefore, the file is forcibly deleted here.
      //removeLockFiles(key);
    }
  });
  */

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
        message: "Couldn't read the lock information file.(readFileSync error!)",
        file: getLockMetaPath(key)
      });
    }
    finally {
      // Since the read operation fails, the contents of the lock information file cannot be verified, preventing it from being deleted normally—meaning other locks will perceive it as still locked.
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
        message:  `Couldn't update the lock information file.(writeFileSync error!)`,
        file:     getLockMetaPath(key)
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
      expect(err).toMatchObject({
        code: "EIO",
        message: "ファイルIOエラーのためロック獲得に失敗しました。",
        cause: {
          code: "EWMOON",
          file: getLockMetaPath(key),
          message: "Couldn't update the lock information file.(writeFileSync error!)",
          cause: {
            code: "EWMOON",
            message: "writeFileSync error!",
          },
        },
      });
    }
  });

  it("前段ロックが無い状態でロック情報ファイル生成（書き込み）に失敗し、かつ、そのファイルの削除にも失敗する.", async () => {
    const key = 'testKey_18465xx_unlink'
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
        { timeoutMs: 200 }
      );
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code: "EIO",
        message: "ファイルIOエラーのためロック獲得に失敗しました。",
        file: getLockMetaPath(key),
        cause: {
          code: "EUNLINK",
          message: "unlinkSync error!",
        },
      });
    }
    finally {
      orgUnlink(getLockMetaPath(key));
    }
  });

  it("existsSync が、特定ファイルが無いにも関わらず、に一度だけtrueを返す.", async () => {
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
      expect(err).toMatchObject({
        code: "EEXISTSYNC",
        file: getLockMetaPath(key),
        message: "Couldn't read the lock information file.(existsSync test error!!)",
        cause: {
          code: "EEXISTSYNC",
          message: "existsSync test error!!",
        },
      });
    }
    finally {
      // ロック解除処理中は読めないので、ここで削除する。
      fs.unlinkSync(getLockMetaPath(key));
    }
  });

  /**
   * ★★★★メタファイルのお掃除確認！！！！！！　
   * 　＊　途中で変更があり、浸食された　⇒　削除しない
   * 　＊　メタ情報が読めなかった　⇒　削除しない
   * 　＊　IOエラー（存在確認も、unlinkも、readも）で読めなかった　⇒　しかたないので削除しない
   * 	
   * 	=>　これらのエラーは、ちゃんとエラーとして報告する。エラーのため、ロック情報ファイルの削除が出来なかったと！！
   * 
   * つまり、最後に削除するのは、存在し、データを読むことができて、オーナー確認ができたら、削除してよろしいい！！
   * 
   */
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
        file: metaPath,
        key: "testKey_18465xx",
        message: `The lock(key: ${key}) has been compromised(Couldn't parse the lock information file, it is probably broken.).`,
      });
      expect(fs.existsSync(metaPath)).toBeTruthy();
    }
    finally {
      fs.unlinkSync(metaPath);
    }
  });

  // ★★★　⇒　壊れていても、無効と判断しない。。。ロックリトライの最後の理由が壊れたロックファイルなら、その情報をエラーメッセージに伝えること！！
  // さて、その方法は、retryの理由も返さないとね、、、、if ((ret = this.#tryLock(...)).locked == false) {...}; 
  // 最後に、ret.reasonに、理由が書かれている、、文字列でいいんでないかな？ 
  // 'METABROKEN', 'LOCKED' くらいかな？？　ＬＯＣＫＥＤなら⇒これまでの、エラーでいいかな。
  // 'METABROKEN'なら、ファイルパスもメッセージにいれたうえで、対処法を記載する。なんなら、エラーメッセージに付け加えるメッセージもありかな、、）
  // 「ロックファイルのメタデータが破損しており、ロック状態を判定できません。
  // 対象プロセスが存在しないことを確認したうえで、必要ならロックファイルを手動で削除してください。」★★これは新エラークラスだな！
  // 的なメッセージかな？

  it("壊れたメタファイルがあった場合は、作成途中の可能性もあるため、リトライを繰り返し、タイムアウトエラーになるはず。", async () => {
    const key = 'testKey_18465xx'

    const metaPath = getLockMetaPath(key);
    // fs.mkdirSync(path.dirname(metaPath));
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
      expect(err).toMatchObject({
        code: 'EBROKEN',
        message: "ロックファイルの内容が破損しており、ロック状態を判定できません。対象プロセスが存在しないことを確認したうえで、必要ならロックファイルを手動で削除してください。",
        file: metaPath,
        cause: {
          code: "ECOMPROMISED",
          file: metaPath,
          contents: "",
          key: "testKey_18465xx",
          optionsOwnerId: undefined,
          message: "The lock(key: testKey_18465xx) has been compromised(Couldn't parse the lock information file, it is probably broken.)."
        }
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
    
    //const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
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
      expect(err).toMatchObject({
        code: "EHISTORY",
        message: "Lock acquisition failure due to history analysis failure.",
        cause: {
          code: "EHISTORY",
          history: histPath,
          message: "Failed to parse the history file.",
          cause: {
            message: "Unexpected token '(', \"()\" is not valid JSON",
          },
        },
      });
    }
    finally {
      fs.rmSync(histPath);
      fs.renameSync(histBu, histPath);
    }
  });

  // FileLock.onExit
  it("history JSON parsing error", async () => {
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
    const meta = {ownerId: "hoge", counter: 1, expirationTime: Date.now() - 100, heartbeatTimeoutMs: 50, lastHeartbeatAt: Date.now() - 100};
    setLockMeta(key, meta);
    let counter = 0;
    // as any?????
    const original = (fs as any)[targetFn];
    // as any?????
    vi.spyOn(fs, targetFn as any).mockImplementation((...args) => {
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

  it("無効なロック情報ファイルがあるとき、それを削除した後の排他オープンが失敗。その後、ロックリトライ成功。", async () => {
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

  it("無効なロック情報ファイルがあるとき、それを削除した後の排他オープンが失敗。その後、ロックリトライ失敗。", async () => {
    const key = "testKey_staleMeta_reopenFailed_lockNg"
    await testSpyIO(
      key,
      'openSync',
      (counter: number) => counter >= 2,
      false, 
      FileLockError,
      {
        code: "EIO",
        file: getLockMetaPath(key),
        message: "ファイルIOエラーのためロック獲得に失敗しました。",
        cause: {
          code: "ENOENT",
          file: getLockMetaPath(key),
          message: `Couldn't remove the lock information file.(ENOENT: no such file or directory, unlink '${getLockMetaPath(key)}')`,
          cause: {
            code: "ENOENT",
            //errno: -4058,
            path: getLockMetaPath(key),
            syscall: "unlink",
          },
        },
      }
    );
  });

  it("無効なロック情報ファイルがあるとき、それの削除に失敗。その後ロック成功。", async () => {
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
        file: getLockMetaPath(key),
        key: key,
        message: `Could not lock because the '${key}' is already locked.`
      }
    );
  });

  it("無効なロック情報ファイルがあるとき、それの削除に失敗。その後ロック失敗。", async () => {
    const key = "testKey_staleMeta_unlinkFailed_lockNG";
    await testSpyIO(
      key,
      'unlinkSync',
      () => true,
      false, 
      FileLockError,
      {
        code: "EIO",
        file: getLockMetaPath(key),
        message: "ファイルIOエラーのためロック獲得に失敗しました。",
        cause: {
          code: "EEXIST",
          file: getLockMetaPath(key),
          message: "Couldn't remove the lock information file.(#####)",
          cause: {
            code: "EEXIST",
            message: "#####",
          },
        },
      }
    );
  });

});
