import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

import { FileLock, type FileLockConfig, type FileLockOptions } from '../src/index.ts';
import { getLockMetaPath, sleepAsync, execChild, childErrCount, childExecCount, childErrors, resetExecResources, getLockSharerDir } from './FileLockTestCommon.ts';

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
  console.log("### Child exec count =", childExecCounts);
  console.log("### Child error count =", childErrCounts);
});

afterAll(() => {
  console.log(`### Child errors(count = ${childErrors.length}) =`, childErrors);
});

describe('ストレステスト', () => {
/*
  function childCompeleted() {
    for (const v of stdOut) {
      if (v.includes("lock completed")) return true;
    }
    return false;
  }
*/
  /**
   * 
   * @param n       同時実行するプロセス数(うち、1個は親(本)プロセス、n-1個は子プロセス)
   * @param oneKey  全て同じキーにする場合に利用するキー
   */
  async function testMultiProcess(n: number, oneKey?: string) {
    const options: FileLockOptions = { timeoutMs: 1000, ttlMs: 1000, heartbeatTtlMs: 2000 };
    const parentKey = oneKey ? oneKey : "testMultiProcess"
    const parentPr = FileLock.withLock(parentKey, async () => { await sleepAsync(500); return 'completed'; }, options);
    //const children = {} as Record<string, { cid: ChildProcessWithoutNullStreams, promise: Promise<unknown> }>;
    const childrenPr = [] as Promise<unknown>[];
    const childrenKey = [] as string[];
    for( let i = 0; i < n - 1; i++) {
      /*
      const nDigits = Math.floor(Math.log10(99));
      const zero = nDigits > 0 ? '0000'.slice(0, -nDigits) : '0000';
      */
     const key = oneKey ? oneKey : `childKey_${String(i).padStart(4, '0')}`;
      //children[key] = await execChild('lock', { key, sleep: 500, waitAquired: false, ...options });
      childrenPr.push((await execChild('lock', { key, sleep: 500, waitAquired: false, ...options })).promise);
      if (oneKey === undefined) childrenKey.push(key);
    }

    //const results = await Promise.allSettled([parentPr, ...Object.values(children).map(async ({ promise }) => promise)]);
    const results = await Promise.allSettled([parentPr, ...childrenPr]);
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      value: 'completed'
    });
    // ロックファイルが削除されていることを確認
    expect(fs.existsSync(getLockMetaPath(parentKey))).toBeFalsy();
    // ロックファイルが削除されていることを確認
    expect(fs.existsSync(getLockSharerDir(parentKey))).toBeFalsy();
   
    childrenPr.forEach((_, i) => {
      if (childrenKey.length === childrenPr.length) {
        expect(fs.existsSync(getLockMetaPath(childrenKey[i]))).toBeFalsy();
      } 
      const result = results[i+1];
      if (result.status === 'rejected') {
        // 破損系エラーではないことを確認する
        const reason = ('reason' in result) ? result.reason as string : ''; 
        //expect(reason.includes('AlreadyLocked') || reason.includes('TTLExceeded')).toBeTruthy();
        expect(reason.includes('LockFileBroken') || reason.includes('LockCompromised')).toBeFalsy();
      }
      else {
        expect(results[i+1]).toMatchObject({
          status: 'fulfilled',
          value: { code: 0, signal: null, }
        });
      }
    });
    /*
    Object.keys(children).forEach((key, i) => {
      expect(fs.existsSync(getLockMetaPath(key))).toBeFalsy();
      const result = results[i+1];
      if (result.status === 'rejected') {
        // 破損系エラーではないことを確認する
        const reason = ('reason' in result) ? result.reason as string : ''; 
        //expect(reason.includes('AlreadyLocked') || reason.includes('TTLExceeded')).toBeTruthy();
        expect(reason.includes('LockFileBroken') || reason.includes('LockCompromised')).toBeFalsy();
      }
      else {
        expect(results[i+1]).toMatchObject({
          status: 'fulfilled',
          value: { code: 0, signal: null, }
        });
      }
    });
    */
  }

  it("すべて同じキーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    await testMultiProcess(5, "multiProcessLockWithSameKey");
  });

  it("すべて同じキーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    //await testMultiProcess(50);
  });

return;
  it("すべて別キーの複数のプロセスを同時に5個起動し、いずれも、問題なく処理が正常終了する。", async () => {
    await testMultiProcess(5);
  });

  it("すべて別キーの複数のプロセスを同時に10個起動し、いずれも、問題なく処理が正常終了する。", async () => {
    await testMultiProcess(10);
  });

  it("すべて別キーの複数のプロセスを同時に25個起動し、いずれも、問題なく処理が正常終了する。", async () => {
    await testMultiProcess(25);
  });

  it("すべて別キーの複数のプロセスを同時に50個起動し、いずれも、問題なく処理が正常終了する。", async () => {
    await testMultiProcess(50);
  });

  it("すべて別キーの複数のプロセスを同時に100個起動し、いずれも、問題なく処理が正常終了する。", async () => {
    await testMultiProcess(100);
  });


  // そして、上記の先に自分、あとから、別プロセスの順で、同様のことをテストする。
  // 起動した結果が何らかの形で取得できるような仕掛けにする必要ありだね。

});


/*

複数子プロセス → 同時Lock競合
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
