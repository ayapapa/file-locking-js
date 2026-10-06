import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { PrettyConsole, type Config as PrettyCOnfig,  type LogEntry } from '@ayapapa-npm/pretty-console-js';
import { pino } from 'pino'
import { createStream } from 'rotating-file-stream'

import { FileLock } from '../src/index.ts';
import { type FileLockRequiredOptions } from '../src/lib/FileLockOptions.ts';

export async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const isCI = process.env.CI === 'true';

const config = { level: 'debug', compact: true } as PrettyCOnfig;

// CIの時は、ファイルログは出力しない（CIエラー対策）
if (isCI === false) {
  const logDir = path.resolve('./logs')
  fs.mkdirSync(logDir, { recursive: true })

  /*
  const stream = Pino.transport({
    target: 'pino/file',
    options: {
      destination: './logs/file-lock.log',
      frequency: 'daily',
      size: '5m',
      mkdir: true,
    },
  });
  */

  const stream = createStream((time: Date | number) => {
    if (!time) return 'file-lock.log'
    const date = new Date(time);
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `file-lock-${yyyy}-${mm}-${dd}.log`
  }, {
    path: logDir,
    interval: '1d',
    intervalBoundary: true,
    initialRotation: true,
    maxFiles: 14
  });

  const pinoLogger = pino(
    {
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: label => ({ level: label.toUpperCase() }),
      },
    },
    stream,
  );

  const onPrettyLog = ( logEntry: LogEntry ) => {
    const method = logEntry.method === 'log' ? 'info' : logEntry.method;
    const err = logEntry.args.find(arg => arg instanceof Error);
    if (err) {
      // Pino's type definition expects the second argument to be a string.
      // Use Reflect.apply to pass the arguments as-is.
      Reflect.apply(pinoLogger[method], pinoLogger, [err, logEntry.args]);    }
    else {
      pinoLogger[method](logEntry.args);
    }
  }

  config.onLog = onPrettyLog;

}

export const logger = new PrettyConsole(config);

export function getLockMetaPath(key: string): string {
  return path.join(TestLock.getLockDirPath(), key + '.json');
  //return path.join(TestLock.getLockDirPath(), key, 'meta.json');
}

export function getLockSharerDir(key: string): string {
  return path.join(TestLock.getLockDirPath(), key + '.sharer');
  //return path.join(TestLock.getLockDirPath(), key, 'meta.json');
}

export const getLockMeta = (key: string) => {
  const lockMetaPath = getLockMetaPath(key);
  const contents: string = fs.readFileSync(lockMetaPath, 'utf8');
  return JSON.parse(contents);
};

export const setLockMeta = (key: string, meta: unknown) => {
  const lockMetaPath = getLockMetaPath(key);
  fs.mkdirSync(path.dirname(lockMetaPath), {recursive: true});
  fs.writeFileSync(lockMetaPath, JSON.stringify(meta));
};

export function removeLockFiles(key: string) {
  const lockMetaPath = getLockMetaPath(key);
  if (fs.existsSync(lockMetaPath)) fs.unlinkSync(lockMetaPath);
  const lockMetaTmpPath = getLockMetaPath(key) + '.tmp';
  if (fs.existsSync(lockMetaTmpPath)) fs.unlinkSync(lockMetaTmpPath);
  const sharer = getLockSharerDir(key);
  if (fs.existsSync(sharer)) fs.rmSync(sharer, { force: true, recursive:true });
  /*
  const lockMetaPath = path.dirname(getLockMetaPath(key));
  if (fs.existsSync(lockMetaPath)) fs.rmSync(lockMetaPath, { recursive: true, force: true });
  */
}

export function getHistoryPath() {
  return TestLock.getHistoryPath();
  //return FileLock.getHistoryInfo().historyPath;
}

export interface Options {
  key: string, 
  sleep: number, 
  timeOutMs?: number, // default is 5000 
  ttlMs?: number, // default is 2000
  waitAquired?: boolean, // default is false
};

export const commandPath = './subCommand.ts';
export const stdOut: string[] = [];
export const stdErr: string[] = [];
export const childErrors = [] as string[];
export let childErrCount = 0;
export let childExecCount = 0;

export function resetExecResources() {
  stdOut.splice(0);
  stdErr.splice(0);
  childErrCount = 0;
  childExecCount = 0;
}

// 別プロセスを非同期で実行する関数を用意する。
export async function execChild(command: 'lock' | 'sleep', options: Options) {
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
    if (str.includes('Child acquired lock')) {
      locked = true;
    }
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

  if (options.waitAquired && command === 'lock') {
    const cStart = Date.now();
    // 子プロセスのロック処理突入を確認
    while(locked === false && (Date.now() - cStart) <= options.sleep + 110/** マージンが必要なようだ、、そうでないと先をこされる*/) {
      await sleepAsync(100);
    }
  }

  return { cid: child, promise };
} 


/**
 * テスト用ロック。
 */
// @ts-expect-error constructor of `FileLock` is private.
export class TestLock extends FileLock {

  static getExitFuncs() {
    return super["_onExitFns"];
  }

  static getLock(key: string): TestLock {
    return new TestLock(super["_getLock"](key));
  }

  static isReleasedStateDetail(key: string) {
    const lock = this.getLock(key);
    return {
      lock_acquired: lock["_acquired"] === false ? 'ok' : 'ng',
      lock_heartbeatTimer: lock["_heartbeatTimer"] === null ? 'ok' : 'ng', 
      lockfile_removed: fs.existsSync(getLockMetaPath(key)) === false ? 'ok' : 'ng',
      lockSharersDir_removed: fs.existsSync(getLockSharerDir(key)) === false ? 'ok' : 'ng',
      lockfile_tmp_removed: fs.existsSync(getLockMetaPath(key) + '.tmp') === false? 'ok' : 'ng',
    }
  }
  static isReleasedState(key: string): boolean {
    const state = this.isReleasedStateDetail(key);
    return state.lock_acquired === 'ok' &&
      state.lock_heartbeatTimer === 'ok' && 
      state.lockfile_removed === 'ok' &&
      state.lockSharersDir_removed === 'ok' &&
      state.lockfile_tmp_removed === 'ok';
  }

  static getLockDirPath() {
    return super["_getLockDirPath"]();
  }

  static getCache() {
    return super["_getCache"]();
  }

  static clearCache() {
    const cache = this.getCache();
    if (cache) cache.clear();
  }

  static getCacheSize() {
    const size = (this.getCache()?.size) ?? 0;
    return size;
  }

  static getHistoryPath(): string {
    return FileLock.getHistoryInfo().historyPath;
  }


  static testAddOnExit(fn: (code: unknown, signal: unknown)=>void): void {
    super._addOnExit(fn);
  }

  constructor(lock?: FileLock) {
    super("TestLock_Key");
    Object.assign(this, lock);
  }

  getReentrantContext() {
    return super["_getReentrantContext"]();
  }

  async testWithLockEmptyOptions(cb: () => unknown): Promise<unknown> {
    return super["withLock"](cb, {} as FileLockRequiredOptions);
  }
  debugLog(...args: unknown[]) {
    this._debugLog(...args);
  }

}


FileLock.setConfig({ logger, history: true, _debug: true });
