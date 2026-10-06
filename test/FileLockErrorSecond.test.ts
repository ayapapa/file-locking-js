import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getHistoryPath,  getLockMetaPath, getLockSharerDir, removeLockFiles, setLockMeta, sleepAsync, TestLock  } from './FileLockTestCommon.ts';
import { AlreadyLocked, type FileLockConfig,  FileLock, FileLockError, ReleaseFailed, type LockMonitor } from '../src/index.ts';
//import { FileLockOptionsResolver } from '../src/lib/FileLockOptionsResolver.ts';



let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});

describe('なぜかテストが通らない、、、困ったちゃんですな。', () => {
/*
  it("JSONエラーになるロックファイル残存", async () => {
    const key = "BadJsonLockFile";
    fs.writeFileSync(getLockMetaPath(key), '()', 'utf-8');
    try {
      await FileLock.withLock(key, () => {}, { timeoutMs: 0 });
    }
    catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: "EALREADYLOCKED",
        key,
        message: "Lock file already exists, but its metadata is invalid.",
        reason: "InvalidMetadata",
        causes: [{
          contents: '()',
          key,
          message: "The lock was compromised during the locking process.",
          path: getLockMetaPath(key),
        }]
      })
    }
    finally {
      fs.unlinkSync(getLockMetaPath(key));
    }
  });

  async function testWriteAndUnlinkError(key: string, timeoutMs: number, ErrorClass: new(...args: any[]) => Error, matchObj: object) {
    const orgUnlink = fs.unlinkSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { 
      throw Object.assign(new Error("writeFileSync error!"), { code: 'EWMOON' }); });
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw Object.assign(new Error("unlinkSync error!"), { code: 'EUNLINK' }); });
    expect.assertions(3);
    try {
      await FileLock.withLock(
        key,
        () => {},
        { timeoutMs }
      );
    }
    catch (err) {
      expect(err).instanceOf(ErrorClass);
      expect(err).toMatchObject(matchObj);
    }
    finally {
      // 作りかけのファイルが残っているので、削除する。
      orgUnlink(getLockMetaPath(key) + '.tmp');
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
    });
  });

  it("The generation (writing) of the lock file fails when the preliminary lock is not held, " +
     "and the subsequent attempt to delete the empty file also fails.(AlreadyLocked)", async () => {
    const key = 'testKey_18465xx_unlink_AlreadyLocked'
    await testWriteAndUnlinkError(key, 500, AlreadyLocked, {
      code: "EALREADYLOCKED",
      message: "Lock file already exists and may still be updating.",
      reason: "Updating",
      key,
    });
    //expect(TestLock.isReleasedState(key)).toBeTruthy();
  });

  it("existsSync error occurred during trying lock.", async () => {
    const key = 'testKey_existsSync_error'
    vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw Object.assign(new Error("existsSync test error!!"),  { code: 'EEXISTSYNC' });
    });

    try {
      await FileLock.withLock(
        key,
        async () => {
          await sleepAsync(100);
          return 'completed';
        },
        { timeoutMs: 150 }
      )
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
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
        async () => {
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
        key,
        message: "Processing is interrupted because the lock release or lock counter decrement failed.",
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
        async () => {
          await sleepAsync(100);
        },
        { timeoutMs: 150 }
      );
    }
    catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: "EALREADYLOCKED",
        message: "Lock file already exists and may still be initializing.",
        key,
        reason: "Initializing",
      });
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
        async () => {
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
    }
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });
*/
  // 不正ロックファイルを故意に作成し、ファイルIOエラーを故意に引き起こすテスト
  async function testSpyIO(
    key: string, 
    targetFn: 'openSync' | 'readFileSync' | 'existsSync' | 'unlinkSync' | 'writeFileSync' |'readdirSync' | 'rmSync', 
    spyCb: (counter: number, args: unknown[], orgFn: (...args: unknown[]) => unknown) => unknown, 
    sucsess: boolean, 
    ErrClass: unknown, 
    matchObj: object,
    sweep = false,
    meta: Record<string, unknown> | null = {ownerId: "hoge", expirationTime: Date.now() - 100, heartbeatTtlMs: 50, lastHeartbeatAt: Date.now() - 100},
    ) {

    if (meta) setLockMeta(key, meta);

    let counter = 0;

    const original = fs[targetFn] as (...args: unknown[]) => unknown;

    const spy = vi.spyOn(fs, targetFn).mockImplementation((...args: unknown[]) => {
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
/*
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

  it("An invalid lock file exists; the initial attempt to open exclusively failed, determin that it is invalid; " +
     "a subsequent attempt to open the temporary lock file exclusively also failed; consequently, the locking operation fails..", async () => {
    const key = "testKey_staleMeta_reopenFailed_lockNg"
    await testSpyIO(
      key,
      'openSync',
      (counter, args, orgFn) => {
        if (counter >= 2) throw Object.assign(new Error("#####"), { code: "EEXIST"});
        return orgFn(...args);
      },
      false, 
      FileLockError,
      {
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
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
        code: "EALREADYLOCKED",
        path: getLockMetaPath(key),
        key: key,
        message: `Couldn't the lock because the '${key}' is already locked.`
      }
    );
  });

   it("ロック共有ディレクトリのロック失敗（IOエラーによる）", async () => {
    const key = "testKey_sharer_lock";
    await testSpyIO(
      key,
      'openSync',
      (_, args, orgFn) => {
        const filePath = args[0] as string;
        const parent = path.basename(path.dirname(filePath))
        const name = path.basename(filePath)
        if (parent.endsWith('.sharer') && name === '.lock') throw Object.assign(new Error("openSync error!"), { code: 'EOMOON' });
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
      null,
    );

  });

  it("ロック共有者の削除失敗", async () => {
    const key = 'lock_sharer_remove_fail';
    await testSpyIO(
      key,
      'rmSync',
      (_, args, orgFn) => {
        const filePath = args[0] as string;
        const parent = path.basename(path.dirname(filePath))
        const name = path.basename(filePath)
        if (parent.endsWith('.sharer') && name === '.lock') {
          throw Object.assign(new Error("rmSync error!"), { code: 'ERMMOON' });
        }
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
          message: "Failed to remove old lock sharers.",
          causes: [{
            code: "ERMMOON",
            path: path.join(getLockSharerDir(key), '.lock'),
            message: "Couldn't remove the file or directory.(rmSync error!)",
            causes: [
              { code: "ERMMOON", message: "rmSync error!" },
              //{ code: "ERMMOON", message: "rmSync error!" }
            ]
          }],
        }],
      },
      true, // sweep
      null,
    );

  });

  it("ロック共有者のリスト取得失敗", async () => {
    const key = 'Key_readdirSyncErr';
    const targetPath: string = getLockSharerDir(key);
    const cause2 = {
      code: 'ERDMOON',
      path: targetPath,
      message: "Couldn't read the direcroty.(readdirSync error)",
    };
    const cause = {
          code: 'EIO',
          key,
          sharerDir: targetPath,
          message: "Failed to retrieve the list of lock sharers.",
          causes: [cause2]
    };

    await testSpyIO(
      key,
      'readdirSync',
      (_, args, orgFn) => {
        if (targetPath === args[0]) throw Object.assign(new Error('readdirSync error'), { code: 'ERDMOON' });
        return orgFn(...args);
      },
      false, // error
      FileLockError,
      {
        code: "EIO",
        key,
        causes: [cause]
      },
      true, // sweep
      null,
    );
  });

  //removeSharer unlinkSync
  it("ロック共有者削除エラー", async () => {
    const key = 'Key_unlinkSyncErr';
    const targetDir: string = getLockSharerDir(key);

    const cause2 = {
      code: 'EULMOON',
      message: "Couldn't remove the file.(unlinkSync error)",
    };
    const cause = {
          code: 'EIO',
          key,
          message: "Failed to remove the lock request from the lock sharer directory.",
          causes: [cause2]
    };

    await testSpyIO(
      key,
      'unlinkSync',
      (_, args, orgFn) => {
        if (String(args[0]).includes(targetDir) === true && String(args[0]).endsWith('.lock') === false) {
          throw Object.assign(new Error('unlinkSync error'), { code: 'EULMOON' });
        }
        return orgFn(...args);
      },
      false, // error
      ReleaseFailed,
      {
        code: "ERELEASE",
        key,
        message: "Processing is interrupted because the lock release or lock counter decrement failed.",
        causes: [cause]
      },
      true, // sweep
      null,
    );
  });

  it("ロックファイルがあるのに無いと偽る", async () => {
    const key = 'Key_existsSync_false';
    const targetPath = getLockMetaPath(key);

    await testSpyIO(
      key,
      'existsSync',
      (_, args, orgFn) => {
        if (String(args[0]) == targetPath) return false;
        return orgFn(...args);
      },
      false, // error
      AlreadyLocked,
      {
        code: "EALREADYLOCKED",
        key,
        reason: "MetadataReadError",
        message: "The lock file already exists, but its validity could not be determined due to an I/O error.",
        causes:["ENOENT"],
      },
      true, // sweep
    );

  });

  it("前段ロックファイルがあるので、排他オープンに失敗するが、そのファイルの存在を確認すると、無いと言われる。", async () => {
    const key = 'Key_existsSync_false';
    const targetPath = getLockMetaPath(key);

    await testSpyIO(
      key,
      'existsSync',
      (_, args, orgFn) => {
        if (String(args[0]) == targetPath) return false;
        return orgFn(...args);
      },
      false, 
      AlreadyLocked,
      {
        code: "EALREADYLOCKED",
        key,
        reason: "MetadataReadError",
        message: "The lock file already exists, but its validity could not be determined due to an I/O error.",
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

*/

it("不正なロックファイルを故意に作成し、エラーとなることを確認する", async () => {
    const key = "invalid_locklfile_error";
    const meta = {};
    setLockMeta(key, meta);
    expect.assertions(3);
    try {
      await FileLock.withLock(key, () => {}, { heartbeatTtlMs: 200, timeoutMs: 300 });
    }
    catch (err) {
      expect(err).instanceOf(AlreadyLocked);
      expect(err).toMatchObject({
        code: "EALREADYLOCKED",
        key,
        reason: "InvalidMetadata",
        message: "Lock file already exists, but its metadata is invalid."
      });
    }
    finally {
      removeLockFiles(key);
      expect(TestLock.isReleasedState(key)).toBeTruthy();
    }
  });


  // tmp作成したフリ（つまり、作成してみたが、できずに、さらにエラーになっていないケース）して、進める。
  // すると、tmpファイル書き込みエラーになり、結局、ロックできなかったエラーになるはず。
  // そして、その場合でも、tmpファイル含めて、全てがクリーンであることをチェックする。
  it("上記の通り", async() => {
    const key = "fakeTmpCreation";
    const openSync = fs.openSync as (...args: unknown[]) => number;
    const dummyFd = -18465;
    vi.spyOn(fs, 'openSync').mockImplementation((...args: unknown[]): number => {
      if (args[0] === getLockMetaPath(key) + '.tmp') {
        return dummyFd; // オープンせずに適当な値を返す
      }
      return openSync(...args);
    });
    const closeSync = fs.closeSync;
    vi.spyOn(fs, 'closeSync').mockImplementation((...args: unknown[]): void => {
      if (args[0] === dummyFd) {
        return;
      }
      closeSync(args[0] as number);
    });

    try {
      await FileLock.withLock(key, () => {}, { timeoutMs: 0});
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [{
          code: "ENOENT",
          key,
          message: "[VERIFY] The temporary `lock file` must exist, but it's not found."
        }],
      });
    }
    finally {
      vi.restoreAllMocks();
      expect(TestLock.isReleasedState(key)).toBeTruthy();
    }
  });

  // tmp作成したフリ（つまり、作成してみたが、できずに、さらにエラーになっていないケース）して、進める。
  // すると、tmpファイル書き込みエラーになり、結局、ロックできなかったエラーになるはず。
  // その後、さらに、rmSyncそ失敗させて、ロック空ファイルが残ってしまテスト。
  // 最後に、強制削除してテスト終了する。
  it("上記の通り2", async() => {
    const key = "fakeTmpCreationAndRmError";
    const openSync = fs.openSync as (...args: unknown[]) => number;
    const dummyFd = -18465;
    const path = getLockMetaPath(key);
    vi.spyOn(fs, 'openSync').mockImplementation((...args: unknown[]): number => {
      if (args[0] === path + '.tmp') {
        return dummyFd; // オープンせずに適当な値を返す
      }
      return openSync(...args);
    });
    const closeSync = fs.closeSync;
    vi.spyOn(fs, 'closeSync').mockImplementation((...args: unknown[]): void => {
      if (args[0] === dummyFd) {
        return;
      }
      closeSync(args[0] as number);
    });
    vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw Object.assign(new Error("rmSyncError!!"), { code: "ERMMOON" }) });

    try {
      await FileLock.withLock(key, () => {}, { timeoutMs: 0});
    }
    catch (err) {
      expect(err).instanceOf(FileLockError);
      expect(err).toMatchObject({
        code: "EIO",
        key,
        message: "Failed to acquire the lock due to a file I/O error.",
        causes: [{
          code: "ERMMOON",
          path: path,
          message: "Failed to remove the `lock file`(rmSyncError!!)",
          causes: [{
            code: "ERMMOON",
            message: "rmSyncError!!",
          }]
        }],
      });
    }
    finally {
      vi.restoreAllMocks();
      expect(fs.existsSync(path)).toBeTruthy();
      fs.unlinkSync(path);
      expect(TestLock.isReleasedState(key)).toBeTruthy();
    }
  });

  it("一時ロックファイル作成失敗", async () => {
    const key = "createTmpFailed";
    await testSpyIO(
      key,
      'openSync',
      () => {
        throw Object.assign(new Error("openSync error!"), { code: 'EOMOON' });
      },
      false, // error
      FileLockError,
      {
        code: 'EIO',
        message: "Failed to acquire the lock due to a file I/O error.",
        key,
        causes: [{
          code: "EOMOON",
          path: getLockMetaPath(key) + '.tmp',
          message: "Couldn't create the file.(openSync error!)",
          causes: [{
            code: "EOMOON",
            message: "openSync error!",
          }]
        }],
      },
      false, // sweep
      null,
    );

  });

  /**
   * テスト用
   * 浸食エラーを割り込みと判定しないテストのためのクラス。
   */
  class TestLockNoInterrupt extends TestLock {

    static getLock(key: string): TestLockNoInterrupt {
      return new TestLockNoInterrupt(super["_getLock"](key));
    }

    constructor(lock?: FileLock) {
      super(lock);
    }

    protected _interruptPromise(): { promise: Promise<unknown>; resolve: (v: unknown) => void; reject: (r?: unknown) => void; } | undefined {
      return;
    }
  }

  // カバレッジ対策のために追加
  it("浸食エラーを割り込みと判定しない", async () => {
    const key = 'noInterrupt';
    const lock = TestLockNoInterrupt.getLock(key);

    expect(lock["_interruptPromise"]()).toBeUndefined();

    expect(await lock["withLock"](()=>{return 'complete'}, FileLock.getDefaultOptions())).toBe('complete');
  });

});

