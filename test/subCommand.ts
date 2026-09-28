//import { stderr } from "node:process";
import { onExit } from 'signal-exit';
import { FileLock, type LockMonitor } from "../src/index.ts";

import { sleepAsync } from "./FileLockTestCommon.ts";
/*
onExit((code, signal) => {
  console.log("Child process exited by", code, signal);
});
*/

const config = FileLock.getConfig();

// extract command args
const args: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  args.push(process.argv[i]);
}

console.log('process.argv:', process.argv);
console.log('sub-command args:', args);

const instruction = {
  'sleep': async () => {
    await sleepAsync(Number(args[1]))
    console.log('sleep completed')
  },
  'lock': async () => {
    const key = args[1];
    let sleepTime = Number(args[2]);
    const timeoutMs = args[3] ? Number(args[3]) : 5000;
    const ttlMs = args[4] ? Number(args[4]) : 2000;
    let monitor!: LockMonitor;
    await FileLock.withLock(
      key, async (mon) => {
        monitor = mon;
        const sleep = Math.floor(sleepTime / 10);
        for (; sleepTime > 0; sleepTime -= sleep) {
          await sleepAsync(sleep);
          if (mon.cancelled) {
            const hoge = 0;
            console.info('###lock interrupted.###')
            //console.error('lock interrupted.')
          }
        }
      },
      { timeoutMs, ttlMs }
    );
    console.log('lock completed.')
  },
} as Record<string, any>;

const ins = instruction[args[0]];
console.log('do it.')
try {
  if (ins) await ins();
}
catch (err) {
  console.error("[ERROR]", err);
  process.exit(1);
}
console.log('finished it.')
