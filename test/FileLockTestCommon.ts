import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole, type LogEntry } from '@ayapapa-npm/pretty-console-js';
import * as Pino from 'pino'
import { pino } from 'pino'

import { FileLock } from '../src/index.ts';

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
  return path.join(TestLock.getLockDirPath(), key, 'meta.json');
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
  const lockMetaPath = path.dirname(getLockMetaPath(key));
  if (fs.existsSync(lockMetaPath)) fs.rmSync(lockMetaPath, { recursive: true, force: true });
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
export class TestLock extends (FileLock as any) {
  constructor(lock?: FileLock) {
    super("TestLock_Key");
    Object.assign(this, lock);
  }

  static getLock(key: string): TestLock {
    return new TestLock(super._getLock(key));
  }

  static getLockDirPath() {
    return super._getLockDirPath();
  }

  static getLockMetaFilePath(key: string) {
    return path.join(TestLock.getLockDirPath(), key, 'meta.json');
  }

  static getCache() {
    return super._getCache();
  }

  static getCacheSize() {
    return this.getCache().size;
  }

  getReentrantContext() {
    return super._getReentrantContext();
  }

  static getHistoryPath(): string {
    return path.join(TestLock.getLockDirPath(), 'history.json')
  }

  async testWithLockEmptyOptions(cb: () => any): Promise<any> {
    return super.withLock(cb, {});
  }

}

FileLock.setConfig({ logger, history: true, _debug: true });
