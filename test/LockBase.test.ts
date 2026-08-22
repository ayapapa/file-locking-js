import { describe, expect, it } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLock } from '../src/index';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const logger = new PrettyConsole({ level: 'trace' });

FileLock.setConfig({ logger });

describe('FileLock', () => {

  it("The reentrancy context is shared even when the lock instances are different.", async () => {
    const als = (LockBase as any).als;
    const rc: ReentrantContext = als.getStore();
    const childContext: ReentrantContext = { heldLocks: new Map(rc?.heldLocks) };
    const contextId = 'text-context';
    childContext.heldLocks.set(contextId, { monitor: { cancelled: false } });
    als.run(childContext, async () => {
      const key1 = 'testKey1', key2 = 'testKey2';
      const ins1 = (FileLock as any).getLock(key1) as LockBase as any;
      const ins2 = (FileLock as any).getLock(key2) as LockBase as any;
      expect(ins1 !== ins2).toBe(true);
      expect(ins1.getReentrantContext().heldLocks.has(contextId)).toBe(true);
      expect(ins2.getReentrantContext().heldLocks.has(contextId)).toBe(true);
    });
  });

});
