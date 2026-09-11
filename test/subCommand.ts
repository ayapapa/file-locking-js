import { stderr } from "node:process";
import { onExit } from 'signal-exit';
import { FileLock, type Monitor } from "../src/index.ts";
import { sleepAsync } from "./FileLockTestCommon.ts";


onExit((code, signal) => {
  console.log("Child process exited by", code, signal);
});

const config = FileLock.getConfig();

// extract command args
const args: string[] = [];

for (let i = 2; i < process.argv.length; i++) {
  args.push(process.argv[i]);
}

console.log(args);

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
if (ins) await ins();

// Remove acquired locks on exit
