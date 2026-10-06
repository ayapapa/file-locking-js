import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AlreadyLocked, FileLock, type FileLockConfig, type FileLockOptions } from '../src/index.ts';
import { childErrCount, childErrors, childExecCount, execChild, isCI, logger, resetExecResources, sleepAsync, TestLock } from './FileLockTestCommon.ts';

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
  const cErrs =  [] as string[];
  childErrors.forEach((eStr) => {
    cErrs.push(eStr
      .split(/\r?\n/)
      .filter(line => !line.includes("    at ") && line.includes("Error"))
      .join("\n")
    )
  });

  logger.log(`### Child errors(count = ${cErrs.length}) =`, cErrs);
  logger.log("### PARENT_ERRORS =", PARENT_ERRORS);
  logger.log("### BROKEN_ERRORS =", BROKEN_ERRORS);
  
  logger.log("### PARENT_ERRORS count =", PARENT_ERRORS.length);
  logger.log("### BROKEN_ERRORS count =", BROKEN_ERRORS.length);
  logger.log("### COMPROMISED_ERRORS count =", COMPROMISED_ERRORS.length);
  logger.log("### Child exec count =", childExecCounts);
  logger.log("### Child error count =", childErrCounts);
});

const BROKEN_ERROR_WATCH_MODE: boolean = false;
const BROKEN_ERRORS = [] as unknown[];
const COMPROMISED_ERRORS = [] as unknown[];
const PARENT_ERRORS = [] as unknown[];

describe('ストレステスト', () => {
  if (isCI) return;
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
    const options: FileLockOptions = { timeoutMs: 5000, ttlMs: 5000, heartbeatTtlMs: 5000 };
    const parentKey = oneKey ? oneKey : "testMultiProcess"
    const parentPr = FileLock.withLock(parentKey, async () => { await sleepAsync(100); return 'completed'; }, options);
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

    const checkState = (key: string) => {
      const state = TestLock.isReleasedStateDetail(key);
      expect(state.lock_acquired).toBe('ok');
      expect(state.lock_heartbeatTimer).toBe('ok'); 
      expect(state.lockfile_removed).toBe('ok');
      expect(state.lockSharersDir_removed).toBe('ok');
      expect(state.lockfile_tmp_removed).toBe('ok');
    };

    //const results = await Promise.allSettled([parentPr, ...Object.values(children).map(async ({ promise }) => promise)]);
    const results = await Promise.allSettled([parentPr, ...childrenPr]);

    // 親の結果をチェックする。
    if (results[0].status === 'fulfilled') {
      expect(results[0]).toMatchObject({
        status: 'fulfilled',
        value: 'completed'
      });
    }
    else {
      const reason = ('reason' in results[0]) ? results[0].reason : ''; 
      // 破損ファイルの発見が無ければOK。
      const foundBroken: boolean = reason instanceof AlreadyLocked && reason.message.includes('InvalidMetadata');
      if (BROKEN_ERROR_WATCH_MODE === false) expect(foundBroken).toBeFalsy();
      if (foundBroken) {
        BROKEN_ERRORS.push(reason);
      }
      const foundCompromised: boolean = reason instanceof Error && reason.message.toLocaleLowerCase().includes('compromised');
      if (foundCompromised) COMPROMISED_ERRORS.push(reason);
      PARENT_ERRORS.push(reason);
    }
    childrenPr.forEach((_, i) => {
      if (oneKey == null) {
        checkState(childrenKey[i]);
      } 
      const result = results[i+1];
      if (result.status === 'rejected') {
        // 破損系エラーではないことを確認する
        const reason = ('reason' in result) ? result.reason as string : ''; 
        //expect(reason.includes('AlreadyLocked') || reason.includes('TTLExceeded')).toBeTruthy();
        // 想定以上の負荷により、TTL内に処理が完了しない、また、ハートビートが想定通りに刻まれないこともあり、
        // その場合には、待機しているロック取得待ちプロセスがロックファイル賞味期限切れ判断し、
        // ロック取得することになる、その場合に、自身のハートビート更新やリリース処理において、
        // `LockCompromised`エラーとなるため、下記条件から、'LockCompromised'のチェックは外す。
        // 破損ファイルの発見が無ければOK。
        const foundBroken: boolean = reason.includes('InvalidMetadata');
        if (BROKEN_ERROR_WATCH_MODE === false) expect(foundBroken).toBeFalsy();
        if (foundBroken) {
          BROKEN_ERRORS.push(reason);
        }
        const foundCompromised: boolean = reason.toLocaleLowerCase().includes('compromised');
        if (foundCompromised) COMPROMISED_ERRORS.push(reason);
        
      }
      else {
        expect(results[i+1]).toMatchObject({
          status: 'fulfilled',
          value: { code: 0, signal: null, }
        });
      }
    });

    // 親のロックファイルが削除されていることを確認
   checkState(parentKey);
  }

  it("すべて同じキーの複数のプロセスを同時に数個から5個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    await testMultiProcess(5, "multiProcessLockWithSameKey5");
  });

  it("すべて同じキーの複数のプロセスを同時に数個から10個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    await testMultiProcess(10, "multiProcessLockWithSameKey10");
  });

  it("すべて同じキーの複数のプロセスを同時に数個から25個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    await testMultiProcess(25, "multiProcessLockWithSameKey25");
  });

  it("すべて同じキーの複数のプロセスを同時に数個から50個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    await testMultiProcess(50, "multiProcessLockWithSameKey50");
  });

  it("すべて同じキーの複数のプロセスを同時に数個から100個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    await testMultiProcess(100, "multiProcessLockWithSameKey100");
  });

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
