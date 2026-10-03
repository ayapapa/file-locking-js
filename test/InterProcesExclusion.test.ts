import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

import { FileLock, ReleaseFailed, type FileLockConfig } from '../src/index.ts';
import { getLockMetaPath, removeLockFiles, sleepAsync, execChild, stdOut, childErrCount, childExecCount, childErrors, resetExecResources, TestLock, type Options, getLockMeta, setLockMeta } from './FileLockTestCommon.ts';

const childExecCounts = [] as number[];
const childErrCounts = [] as number[];

let orgConfig: FileLockConfig;

beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
  resetExecResources();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
  childExecCounts.push(childExecCount);
  childErrCounts.push(childErrCount);
});

afterAll(() => {
  console.log("### Child exec count =", childExecCounts);
  console.log("### Child error count =", childErrCounts);
  console.log(`### Child errors(count = ${childErrors.length}) =`, childErrors);
});

describe('別プロセスとの競合テスト', () => {

  function childCompeleted() {
    for (const v of stdOut) {
      if (v.includes("lock completed")) return true;
    }
    return false;
  }

  it("子プロセスを先に起動し、それを強制終了させるとどうなる？？", async () => {
    const key = 'subKey0011';
    const child = await execChild('lock', { key, sleep: 1000, waitAquired: true });

    expect.assertions(3);

    try {
      await sleepAsync(500);
      child.cid.kill(); // 何を指定しても強制終了となるようだ。
      await child.promise;
    }
    catch(err) {
      expect(err).toBe("child failed: code=null signal=SIGTERM msg=");
    }

    // 強制終了なので、
    // 子プロセスは完了していない
    expect(childCompeleted()).toBeFalsy();
    // ロック情報ディレクトリおよびファイルは残っている
    expect(fs.existsSync(getLockMetaPath(key))).toBeTruthy();
    // ロック情報ディレクトリおよびファイルを消す
    removeLockFiles(key);
  });

  it("子プロセスを先に起動し、別のキーでロックすると、干渉されずにいずれも処理が完了する.", async () => {
    const child = await execChild('lock', { key: 'subKey', sleep: 200 });

    const key = 'mainKey001';
    const start = Date.now();

    await FileLock.withLock(key, async () => {
      await sleepAsync(200);
    })
    const elapsed =  Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(199);
    expect(elapsed).toBeLessThan(1000);

    await child.promise;
    
    expect(childCompeleted()).toBeTruthy();
    
  });

  it("同じキーで、子プロセスを先に起動し、それを待ってロックが完了する.", async () => {
    const key = 'mainKey002';
    const childSleep = 500;
    const parentSleep = 100;
    const child = await execChild('lock', { key, sleep: childSleep, waitAquired: true });
    const start = Date.now();
    await FileLock.withLock(key, async () => {
      await sleepAsync(parentSleep);
      console.log('elapsed =', Date.now() - start);
    })
    const elapsed =  Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(childSleep - 1);

    await child.promise;

    expect(childCompeleted()).toBeTruthy();
  });

  it("同じキーで、親プロセスを先に起動し、それを待って子プロセスのロックが完了する.", async () => {
    const key = 'mainKey002';
    const childSleep = 100;
    const parentSleep = 500;

    const pp = FileLock.withLock(key, async () => {
      await sleepAsync(parentSleep);
      console.log('elapsed =', Date.now() - start);
      return 'complete'
    })

    const start = Date.now();
    const child = await execChild('lock', { key, sleep: childSleep });
    await child.promise;
    expect(await pp).toBe('complete');

    const elapsed =  Date.now() - start;
    console.log('elapsed =', elapsed);
    expect(elapsed).toBeGreaterThanOrEqual(parentSleep - 1);
    expect(childCompeleted()).toBeTruthy();
  });

  it("同じキーをつかい、子プロセスを先に起動し、親プロセスがタイムアウトエラーになる.", async () => {
    const key = 'mainKey009';
    const child = await execChild('lock', { key, sleep: 1000, waitAquired: true });

    const pp = FileLock.withLock(key, async () => {
        await sleepAsync(100);
      },
      { timeoutMs: 0}
    );
    const results = await Promise.allSettled([child.promise, pp]);

    // One of them has resulted in a timeout error (AlreadyLocked).
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      value: { code: 0, signal: null }
    });
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: {
        message: "Lock file already exists.",
        code: 'ELOCKED',
        reason: "ExistingLock",
        key: key
      }
    });
  });

  async function testChildError(key: string, pPara: { sleep: number, timeout: number }, cPara: { sleep: number, ttl?: number }, childFirst: boolean, reason: string): Promise<void> {
    const createParentPr = async () => FileLock.withLock(key, async () => {
        await sleepAsync(pPara.sleep);
        return 'completed'
      },
      { timeoutMs: pPara.timeout }
    );
    const createChild = async () => {
      const cOpts = { key, sleep: cPara.sleep, timeOutMs: 0, waitAquired: true } as Options;
      if (cPara.ttl) cOpts.ttlMs = cPara.ttl;
      return execChild('lock', cOpts);
    };
    const promises = [] as Promise<unknown>[];
    if (childFirst) {
      // It is necessary to wait for the child process to acquire the lock.
      promises.push((await createChild()).promise);
      promises.push(createParentPr());
    }
    else {
      promises.push(createParentPr());
      promises.push((await createChild()).promise);
    }

    const results = await Promise.allSettled(promises/*[child.promise, parent]*/);

    const cIdx = childFirst ? 0 : 1;
    const pIdx = (cIdx + 1) % 2;
    // The child promise should have failed due to `reason`.
    expect(results[cIdx]).toMatchObject({ status: 'rejected' });
    expect('reason' in results[cIdx] && results[cIdx].reason.includes(reason)).toBeTruthy();
    expect(results[pIdx]).toMatchObject({ status: 'fulfilled', value: 'completed' });
  } 

  it("同じキーをつかい、親プロセスを先に起動し、子プロセスがタイムアウトエラーになる.", async () => {
    await testChildError('mainKey008', { sleep: 1000, timeout: 500 }, { sleep: 150 }, false, 'AlreadyLocked');
  });

  it("同じキーを使い、子プロセスを先に起動したがttlエラーになり、処理はキャンセル状態となったところで、親プロセスはロック処理が進む.", async () => {
    await testChildError('mainKey007', { sleep: 500, timeout: 1500 }, { sleep: 1000, ttl: 500 }, true, 'TTLExceeded');
  });

  it("子プロセスを先に起動したが、実行中に、強制的にプロセスをキルする。親プロセスは、ロック情報の無効化を確認後ロック処理が進む.", async () => {
    const key = 'subKey0031';
    const child = await execChild('lock', { key, sleep: 1000, ttlMs: 1100, waitAquired: true });

    await sleepAsync(500);   // ★★★　ここをいじっても、結果は同じ！！　つまり、 killしても、想定通りの振る舞いになっていないようだけれど、、、、！！！！！！
    child.cid.kill();

    const pp = FileLock.withLock(key, async () => {
        await sleepAsync(500);
        return 'completed'
      },
      { timeoutMs: 5000, heartbeatTtlMs: 2000}
    );

    const results = await Promise.allSettled([child.promise, pp]);

    // One of them has resulted in a timeout error (AlreadyLocked).
    expect(results[0]).toMatchObject({
      status: 'rejected',
      //reason: "child failed: code=null signal=SIGTERM msg=" 子プロセスの理由は問わない！！
    });
    expect(results[1]).toMatchObject({
      status: 'fulfilled',
      value: 'completed'
    });

    // 子プロセスは完了していない
    expect(childCompeleted()).toBeFalsy();
  });

  it("同じキーを使い、親プロセスを先に起動したが、親のロックファイルが賞味期限となり、子プロセスがロックファイルを上書きしてロックを取得し完了する", async () => {
    const key = 'keyParentStale001';

    const parentPr = FileLock.withLock(key, async () => {
      const lock = TestLock.getLock(key);

      // ハートビートを強制的に止める
      clearInterval(lock["_heartbeatTimer"] as NodeJS.Timeout);

      lock["_heartbeatTimer"] = null;
      // ロックファイルのttlMsを2000に書き換える
      const meta = getLockMeta(key);
      meta["expirationTime"] = Date.now() + 1950; // 遅延考慮
      setLockMeta(key, meta);

      await sleepAsync(4000);
      return 'completed'
    }, {
      timeoutMs: 1000, ttlMs: 5000, heartbeatTtlMs: 2000
    });

    const child = await execChild('lock', { key, sleep: 450, ttlMs: 1500, timeOutMs: 5000, waitAquired: true });

    const results = await Promise.allSettled([child.promise, parentPr]);

    // The result of child.
    expect(results[0]).toMatchObject({ status: 'fulfilled'/*, value: 'completed'*/ });
    // The result of parent.
    expect('reason' in results[1] && results[1].reason instanceof ReleaseFailed).toBeTruthy();
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: {
        code: "ERELEASE",
        key,
        message: "Processing is interrupted because the lock release or lock counter decrement failed."
      }
    });
    expect(TestLock.isReleasedState(key)).toBeTruthy();
  });


});


/*

TTL / Heartbeat
子Lock中 → TTL超過
子Lock中 → Heartbeat timeout
TTL + Heartbeat両方無効 → Lock失効
子プロセス異常終了
子Lock中 → 正常終了（Unlockあり）
子Lock中 → process.exit()（Unlockなし）
子Lock中 → 親から強制終了
子Lock中 → 例外終了
子プロセス異常終了後 → 親がLock再取得
プロセス境界
親のreentry状態 → 子ではreentryにならない
別プロセス間では同一Lockを同時保持できない
*/
