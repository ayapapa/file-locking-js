import { FileLock, type LockMonitor } from "../src/index.ts";

import { sleepAsync } from "./FileLockTestCommon.ts";

// extract command args
const args: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  args.push(process.argv[i]);
}
/*
console.log('process.argv:', process.argv);
console.log('sub-command args:', args);
*/
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
    const heartbeatTtlMs = args[4] ? Number(args[4]) : 5000;
    let monitor: LockMonitor;
    await FileLock.withLock(
      key, async (mon) => {
        console.info("Child acquired lock");
        monitor = mon;
        const sleep = Math.floor(sleepTime / 10);
        for (; sleepTime > 0; sleepTime -= sleep) {
          await sleepAsync(sleep);
          if (monitor.cancelled) {
            //console.info('###lock interrupted.###')
          }
        }
      },
      { timeoutMs, ttlMs, heartbeatTtlMs }
    );
    console.log('lock completed.')
  },
} as Record<string, (() => Promise<unknown>)>;

const ins = instruction[args[0]];
//console.log('do it.')
try {
  if (ins) await ins();
}
catch (err) {
  console.error("## Child caught [ERROR]", err); 
  /*
  const e = err as Error;
  console.error("[Child caught ERROR]", { 
    message: e.message,
    code: 'code' in e ? e.code : 'none',
    reason: 'reason' in e ? e.reason : 'none',
  });
  */
  process.exit(1);
}
//console.log('finished it.')
