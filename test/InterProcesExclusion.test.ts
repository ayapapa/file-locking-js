import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';
import fs from 'node:fs';
import path from 'node:path';

import { FileLock, FileLockConfig, FileLockOptions, LockError } from '../src/index.ts';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { logger, getLockMetaPath, removeLockFiles, sleepAsync } from './FileLockTestCommon.ts';

const commandPath = './subCommand.ts';
const stdOut: string[] = [];
const stdErr: string[] = [];
let orgConfig: FileLockConfig;
let childErrCount = 0;
let childExecCount = 0;
const childExecCounts = [] as number[];
const childErrCounts = [] as number[];
const childErrors = [] as string[];

beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
  stdOut.splice(0);
  stdErr.splice(0);
  childErrCount = 0;
  childExecCount = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
  childExecCounts.push(childExecCount);
  childErrCounts.push(childErrCount);
  console.log("### Child exec count =", childExecCounts);
  console.log("### Child error count =", childErrCounts);
  console.log(`### Child errors(count = ${childErrors.length}) =`, childErrors);
});

interface Options {
  key: string, 
  sleep: number, 
  timeOutMs?: number, // default is 5000 
  ttlMs?: number, // default is 2000
  waitAquired?: boolean, // default is false
};

describe('別プロセスとの競合テスト', () => {

  // 別プロセスを非同期で実行する関数を用意する。
  async function execChild(command: string, options: Options) {
    const cmodPath = path.isAbsolute(commandPath) ? commandPath : path.resolve(__dirname, commandPath);
    const args: string[] = [
      cmodPath, 
      command, 
      options.key, 
      String(options.sleep), 
      String(options.timeOutMs ?? 5000), 
      String(options.ttlMs ?? 2000)
    ];
    
    // tnode 20.xのバグで、パスに空白が入っていると、spawnそのものが失敗し、子プロセス起動ができない。
    // このため、process.execPathの代わりに、'node'とする =>　結局、'node'としても、ciシステム内で絶対パスに変換され、スペースありのパスになってしまうようなので、解決しなかった、、このため、20.xはciの対象から外した
    //const child = spawn(process.execPath, args);
    const child = spawn('node', args);
    childExecCount++;

    let locked = false;
    let errMsg = '';

    child.stdout?.on('data', data => {
      const str: string = data.toString();
      process.stdout.write(str);
      stdOut.push(str);
      // ★★ロック獲得条件をトレースログを見ていることに注意★★
      // つまり、デバッグ時（かつ、トレースレベルログ時）にのみ有効である。
      if (str.includes('Acquired the lock')) locked = true;
    });
    child.stderr?.on('data', data => {
      const msg = data.toString();
      if (msg.includes('FATAL') || msg.includes('ERROR')) {
        errMsg = msg;
        childErrors.push(msg);
        childErrCount++;
      }
      process.stderr.write(msg);
      stdErr.push(msg);
    });

    const promise = new Promise((resolve, reject) => {
      child.once('error', reject);

      child.once('close', (code, signal) => {
        if (code === 0) {
          resolve({ code, signal });
        } else {
          reject(`child failed: code=${code} signal=${signal} msg=${errMsg}`);
        }
      });
    });

    if (options.waitAquired) {
      const cStart = Date.now();
      // 子プロセスのロック処理突入を確認
      while(locked === false && (Date.now() - cStart) <= options.sleep + 110/** マージンが必要なようだ、、そうでないと先をこされる*/) {
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
    const child = await execChild('lock', { key, sleep: 1000, waitAquired: true });

    expect.assertions(3);
    const start = Date.now();
    try {
      await sleepAsync(500);
      child.cid.kill(); // 何を指定しても強制終了となるようだ。
      await child.promise;
    }
    catch(err) {
      expect(err).toBe("child failed: code=null signal=SIGTERM msg=");
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
    })

    const start = Date.now();
    const child = await execChild('lock', { key, sleep: childSleep });
    await child.promise;

    const elapsed =  Date.now() - start;
    console.log('elapsed =', elapsed);
    expect(elapsed).toBeGreaterThanOrEqual(parentSleep - 1);
    let inc = false;
    expect(childCompeleted()).toBeTruthy();
  });

  it("同じキーをつかい、親プロセスがタイムアウトエラーになる.", async () => {
    const key = 'mainKey009';
    const child = await execChild('lock', { key, sleep: 500, waitAquired: true });

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
        message: `Couldn't acquire the lock because the '${key}' is already locked.`,
        code: 'ELOCKED',
        path: getLockMetaPath(key),
        key: key
      }
    });
  });

  it("同じキーをつかい、子プロセスがタイムアウトエラーになる.", async () => {
    const key = 'mainKey008';

    const pp = FileLock.withLock(key, async () => {
        await sleepAsync(1000);
        return 'completed'
      },
      { timeoutMs: 500}
    );

    const child = await execChild('lock', { key, sleep: 150, timeOutMs: 0, waitAquired: true });

    const results = await Promise.allSettled([child.promise, pp]);

    // One of them has resulted in a timeout error (AlreadyLocked).
    expect(results[0]).toMatchObject({
      status: 'rejected',
    });
    // @ts-ignore
    expect(results[0].reason.includes('AlreadyLocked')).toBeTruthy();
    expect(results[1]).toMatchObject({
      status: 'fulfilled',
      value: 'completed'
    });
  });

  it("別プロセスを先に起動したが、ttlエラーになり、処理はキャンセル状態となったところで、親プロセスはロック処理が進む.", async () => {
    const key = 'mainKey007';

    const child = await execChild('lock', { key, sleep: 1000, timeOutMs: 0, ttlMs: 500, waitAquired: true });

    const pp = FileLock.withLock(key, async () => {
        await sleepAsync(500);
        return 'completed'
      },
      { timeoutMs: 1500}
    );

    const results = await Promise.allSettled([child.promise, pp]);

    // One of them has resulted in a ttl error (TTLExceeded).
    expect(results[0]).toMatchObject({
      status: 'rejected',
    });
    // @ts-ignore
    expect(results[0].reason.includes('TTLExceeded')).toBeTruthy();
    expect(results[1]).toMatchObject({
      status: 'fulfilled',
      value: 'completed'
    });
  });

  it("子プロセスを先に起動したが、実行中に、強制的にプロセスをキルする。親プロセスは、ロック情報の無効化を確認後ロック処理が進む.", async () => {
    const key = 'subKey0031';
    const child = await execChild('lock', { key, sleep: 1000, ttlMs: 1100, waitAquired: true });

    const start = Date.now();

    await sleepAsync(500);   // ★★★　ここをいじっても、結果は同じ！！　つまり、 killしても、想定通りの振る舞いになっていないようだけれど、、、、！！！！！！
    child.cid.kill(); // 何を指定しても強制終了となるようだ。
    /**
     * ★★★
     * 500ms待っても、空の前段ロックファイルを見つけてしまった！！！　 
     * ＝＝＝＞　★★★、、、ちょっと、違うかな！！　残っているのは、共有者情報（.lock\subKey0031.sharer）だけだよ！！　というか、」これは、何度試しても残っている！！
     * ＝＝＝＞　★★★、、、残っているのは、sharerだけだね、、、、、これがヒントかな。。。。
     * ★★しかも、その前段ロックは別プロセス。。。ここが味噌★★★
     * 前段がちゃんとファイル書き込みを済ませるまで待てればいいけれど、今はそれは、出来ないというか、、リトライをするしか、方策が無い。
     * では、どうするか、
     * 前段は、ロックするために、空ファイルを取り合えず作る。
     * と、それは、一時的に、空ファイルになる。
     * 今回は、それを拾って、エラーになった。
     * だとすると、、、、、空ファイル状態を無くせるか？⇒　基本無理。　一瞬でもファイル生成をした直後は空ファイルになる。
     * では、何に対処すればよいのか、、、
     * １）ファイルIOの直列化、、、、これは、これまでも、考えてきたが、、、あまりに、負荷がたかまりそうなので、却下。　その負荷のせいで、タイムアウト続出の予感
     * ２）空ファイルをまだ、途中の存在と想定して、リトライする。、、、案外あるかも。。。しかし、また、ここでリトライ間隔分の時間が発生する。
     * ３）その他なにがあるのか？？？？？
     * 
     *  
     */


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

  /**
   * 
   * @param n       同時実行するプロセス数(うち、1個は親(本)プロセス、n-1個は子プロセス)
   * @param oneKey  全て同じキーにする場合に利用するキー
   */
  async function testMultiProcess(n: number, oneKey?: string) {
    const options: FileLockOptions = { timeoutMs: 1000, ttlMs: 1000, heartbeatTtlMs: 2000 };
    const parentKey = "testMultiProcess"
    const parentPr = FileLock.withLock(parentKey, async () => { await sleepAsync(500); return 'completed'; }, options);
    const children = {} as Record<string, { cid: ChildProcessWithoutNullStreams, promise: Promise<unknown> }>;
    for( let i = 0; i < n - 1; i++) {
      /*
      const nDigits = Math.floor(Math.log10(99));
      const zero = nDigits > 0 ? '0000'.slice(0, -nDigits) : '0000';
      */
     const key = `childKey_${String(i).padStart(4, '0')}`;
      children[key] = await execChild('lock', { key, sleep: 500, waitAquired: false, ...options });
    }

    const results = await Promise.allSettled([parentPr, ...Object.values(children).map(({ promise }) => promise)]);
    expect(results[0]).toMatchObject({
      status: 'fulfilled',
      value: 'completed'
    });
    // ロックファイルが削除されていることを確認
    expect(fs.existsSync(getLockMetaPath(parentKey))).toBeFalsy();
    Object.keys(children).forEach((key, i) => {
      expect(fs.existsSync(getLockMetaPath(key))).toBeFalsy();
      if (results[i+1].status === 'rejected') {
        // 破損系エラーではないことを確認する
        // @ts-ignore
        const reason = results[i+1].reason as string; 
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
  }

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

  it("すべて同じキーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    //await testMultiProcess(50);
  });

  it("すべて同じキーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
    //await testMultiProcess(50);
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
