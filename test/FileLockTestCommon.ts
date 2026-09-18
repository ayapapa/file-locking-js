import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole, type LogEntry } from '@ayapapa-npm/pretty-console-js';
import * as Pino from 'pino'
import { pino } from 'pino'

import { FileLock } from '../src/index.ts';
import { LockBase } from '../src/lib/LockBase.ts';

export async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const transport = Pino.transport({
  target: 'pino/file',
  options: {
    destination: './logs/file-lock.log',
    frequency: 'daily',
    size: '5m',
    mkdir: true,
  },
});

const pinoLogger = pino(
  {
    level: 'trace',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: label => ({ level: label.toUpperCase() }),
    },
  },
  transport,
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

export const logger = new PrettyConsole({ onLog: onPrettyLog, level: 'trace' });

export function getLockMetaPath(key: string): string {
  return path.join(TestLock.getLockDirPath(), key + '.json');
  //return path.join(TestLock.getLockDirPath(), key, 'meta.json');
}

export const getLockMeta = (key: string) => {
  const lockMetaPath = getLockMetaPath(key);
  const contents: string = fs.readFileSync(lockMetaPath, 'utf8');
  return JSON.parse(contents);
};

export const setLockMeta = (key: string, meta: any) => {
  const lockMetaPath = getLockMetaPath(key);
  fs.mkdirSync(path.dirname(lockMetaPath), {recursive: true});
  fs.writeFileSync(lockMetaPath, JSON.stringify(meta));
};

export function removeLockFiles(key: string) {
  const lockMetaPath = getLockMetaPath(key);
  if (fs.existsSync(lockMetaPath)) fs.unlinkSync(lockMetaPath);
  /*
  const lockMetaPath = path.dirname(getLockMetaPath(key));
  if (fs.existsSync(lockMetaPath)) fs.rmSync(lockMetaPath, { recursive: true, force: true });
  */
}

export function getHistoryPath() {
  const orgConf = FileLock.getConfig();
  const dir = path.join(process.cwd(), '.lock');
  return path.join(dir, 'history.json');
}

/**
 * テスト用ロック。
 * プライベートも利用するため、as anyを使用。
 */
// @ts-ignore
export class TestLock extends FileLock {
  constructor(lock?: FileLock) {
    super("TestLock_Key");
    Object.assign(this, lock);
  }

  static getLock(key: string): TestLock {
    // @ts-ignore
    return new TestLock(super._getLock(key));
  }

  static isReleasedState(key: string): boolean {
    const lock = this.getLock(key);
    // @ts-ignore
    return lock._acquired === false && lock._heartbeatTimer === null && fs.existsSync(getLockMetaPath(key)) === false;
  }

  static getLockDirPath() {
    // @ts-ignore
    return super._getLockDirPath();
  }
/*
  static getLockMetaFilePath(key: string) {
    return path.join(TestLock.getLockDirPath(), key, 'meta.json');
  }
*/
  static getCache() {
    // @ts-ignore
    return super._getCache();
  }

  static clearCache() {
    const cache = this.getCache();
    if (cache) cache.clear();
  }

  static getCacheSize() {
    // @ts-ignore
    const size = this.getCache().size;
    return size;
  }

  getReentrantContext() {
    // @ts-ignore
    return super._getReentrantContext();
  }

  /*
  static getHistoryPath(): string {
    return path.join(TestLock.getLockDirPath(), 'history.json')
  }
  */
  async testWithLockEmptyOptions(cb: () => any): Promise<any> {
    // @ts-ignore
    return super.withLock(cb, {});
  }

  static testAddOnExit(fn: (code: unknown, signal: unknown)=>void): void {
    super._addOnExit(fn);
  }

}

FileLock.setConfig({ logger, history: true, _debug: true });
