import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';
import fs from 'node:fs';
import path from 'node:path';

import { FileLock, FileLockConfig, LockError } from '../src/index.ts';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';
import { spawn } from 'node:child_process';
import { logger, getLockMetaPath, removeLockFiles, sleepAsync } from './FileLockTestCommon.ts';

const commandPath = './subCommand.ts';
const stdOut: string[] = [];
const stdErr: string[] = [];
let orgConfig: FileLockConfig;

beforeEach(() => {
  orgConfig = FileLock.getConfig();
  stdOut.splice(0);
  stdErr.splice(0);
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('別プロセスとの競合テスト', () => {

  // 別プロセスを非同期で実行する関数を用意する。
  async function execChild(command: string, key: string, sleep: number, waitAquired: boolean = false) {
    const cmodPath = path.isAbsolute(commandPath) ? commandPath : path.resolve(__dirname, commandPath);
    const args: string[] = [cmodPath, command, key, String(sleep)];
    
    const child = spawn(process.execPath, args);

    let locked = false;

    child.stdout?.on('data', data => {
      const str: string = data.toString();
      process.stdout.write(str);
      stdOut.push(str);
      if (str.includes('Acquired the lock.')) locked = true;
    });
    child.stderr?.on('data', data => {
      const str = data.toString();
      process.stderr.write(str);
      stdErr.push(str);
    });

    const promise = new Promise((resolve, reject) => {
      child.once('error', reject);

      child.once('close', (code, signal) => {
        if (code === 0) {
          resolve({ code, signal });
        } else {
          reject(`child failed: code=${code} signal=${signal}`);
        }
      });
    });

    if (waitAquired) {
      const cStart = Date.now();
      // 子プロセスのロック処理突入を確認
      while(locked === false && (Date.now() - cStart) <= sleep) {
        await sleepAsync(100);
      }
    }

    return { cid: child, promise };
  } 

  function childCompeleted() {
    for (const v of stdOut) {
      if (v.includes("lock completed")) return true;
    }
    return false;
  }

  it("子プロセスを先に起動し、それを強制終了させるとどうなる？？", async () => {
    const key = 'subKey0011';
    const child = await execChild('lock', key, 3000, true);
    const promise = child.promise.catch(err => {
      return err;
    });

    expect.assertions(3);
    const start = Date.now();
    try {
      await sleepAsync(500);
      child.cid.kill(); // 何を指定しても強制終了となるようだ。
      await child.promise;
    }
    catch(err) {
      expect(err).toBe("child failed: code=null signal=SIGTERM");
    }

    const elapsed = Date.now() - start;
    // 強制終了なので、
    // 子プロセスは完了していない
    expect(childCompeleted()).toBeFalsy();
    // ロック情報ディレクトリおよびファイルは残っている
    expect(fs.existsSync(getLockMetaPath(key))).toBeTruthy();
    // ロック情報ディレクトリおよびファイルを消す
    removeLockFiles(key);
  });

  it("子プロセスを先に起動し、別のキーでロックすると、干渉されずにいずれも処理が完了する.", async () => {
    const child = await execChild('lock', 'subKey', 200);

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
    const child = await execChild('lock', key, childSleep, true);
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
    })

    const start = Date.now();
    const child = await execChild('lock', key, childSleep);
    await child.promise;

    const elapsed =  Date.now() - start;
    console.log('elapsed =', elapsed);
    expect(elapsed).toBeGreaterThanOrEqual(parentSleep - 1);
    let inc = false;
    expect(childCompeleted()).toBeTruthy();
  });

  it("別プロセスを先に起動し、最大待ち時間内に終わらないので、タイムアウトエラーになる.", async () => {
  });

  it("別プロセスを先に起動したが、ttlエラーになり、処理はキャンセル状態となったところで、こっちのプロセスはロック処理が進む.", async () => {
  });

  it("別プロセスを先に起動したが、実行中に、強制的にプロセスをキルする。こっちのプロセスは、ロック情報の無効化を確認後ロック処理が進む.", async () => {
  });

  it("すべて別キーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。", async () => {
  });

  it("すべて同じキーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
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
