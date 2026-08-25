import fs from 'node:fs';
import path from 'node:path';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';
import * as pinos from 'pino'
import { pino } from 'pino'

import { FileLock, LogProvider } from '../src/index';

export async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const transport = pinos.transport({
  target: 'pino/file',
  options: {
    destination: './logs/file-lock.log',
    frequency: 'daily',
    //size: '10m',
    mkdir: true,
  },
});

export const logger = pino(
  {
    level: 'trace',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: label => ({ level: label.toUpperCase() }),
    },
  },
  transport,
) as LogProvider;

//export const logger = new PrettyConsole({ level: 'trace' });

export function getLockMetaPath(key: string): string {
  return path.join((FileLock as any).getLockDirPath(), key + '.json');
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
  if (fs.existsSync(lockMetaPath)) fs.rmSync(lockMetaPath);
}

FileLock.setConfig({ logger, ErrorStackTraceLimit: 20 });
