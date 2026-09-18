//import { stderr } from "node:process";
import { onExit } from 'signal-exit';
import { FileLock, type Monitor } from "../src/index.ts";

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

// デバッグのため一時的に以下を追加して実験中
//if (args.length == 0) args.push(...['lock', 'key_hogehoge', '3000']); // #1
//if (args.length == 0) args.push(...['sleep', '3000']); // #2

const instruction = {
  'sleep': async () => {
    await sleepAsync(Number(args[1]))
    console.log('sleep completed')
  },
  'lock': async () => {
    const key = args[1];
    let sleepTime = Number(args[2]);
    let monitor!: Monitor;
    await FileLock.withLock(
      key, async (mon) => {
        monitor = mon;
        const sleep = Math.floor(sleepTime / 10);
        for (; sleepTime > 0; sleepTime -= sleep) {
          await sleepAsync(sleep);
          if (mon.cancelled) {
            console.error('lock interrupted.')
          }
        }
      },
      {}
    );
    console.log('lock completed.')
  },
} as Record<string, any>;

const ins = instruction[args[0]];
console.log('do it.')
if (ins) await ins();
console.log('finished it.')

// #1のケースでは、以下を実行しないとプロセスが終了しない ⇒　タイマーが止まっていなかった。
//process.exit(0);
