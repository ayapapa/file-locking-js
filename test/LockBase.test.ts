import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLock, FileLockConfig, LockError } from '../src/index';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';
import { Monitor } from '../src/lib/LockBaseInternalState.ts'
import { AsyncLocalStorage } from 'node:async_hooks';
import { TestLock } from './FileLockTestCommon.ts'
import { getCallStack, sleepAsync, sleepSync } from '../src/lib/Util.ts'

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

describe('LockBase and Util', () => {

  it("The reentrancy context is shared even when the lock instances are different.", async () => {
    const als = (LockBase as any)._als as AsyncLocalStorage<ReentrantContext>;
    const rc: ReentrantContext | undefined = als.getStore();
    const childContext: ReentrantContext = { heldLocks: new Map(rc?.heldLocks) };
    const contextId = 'text-context';
    childContext.heldLocks.set(contextId, { monitor: { cancelled: false } });
    als.run(childContext, async () => {
      const key1 = 'testKey1', key2 = 'testKey2';
      const ins1 = TestLock.getLock(key1);
      const ins2 = TestLock.getLock(key2);
      expect(ins1 !== ins2).toBe(true);
      expect(ins1.getReentrantContext()?.heldLocks.has(contextId)).toBe(true);
      expect(ins2.getReentrantContext()?.heldLocks.has(contextId)).toBe(true);
    });
  });

  it("`sleepAsync()`が指定通りの時間眠る.", async () => {
    const start = Date.now();
    await sleepAsync(100);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(99);
  });

  it("`sleepSync()`が指定通りの時間眠る.", async () => {
    const start = Date.now();
    sleepSync(100);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(99);
  });

  class TestLockBase extends LockBase {
    constructor() {
      super("Key");
    }

    test_incReantryCount() {
        this._incReantryCount({ _ownerId: "", _contextId: "" } as any);
    }

    test_decReantryCount() {
        this._decReantryCount({ _ownerId: "", _contextId: "" } as any);
    }

    test_onError(err: Error, op: string) : Monitor {
      const opts = { _ownerId: "", _contextId: "" };
      this._onError(err, op, opts as any);
      return '_monitor' in opts ? opts._monitor as Monitor : { cancelled: false };
    }
  }

  function testNotImpleMethod(cb: () => void) {
    expect.assertions(3)
    try {
      cb();
    }
    catch (err) {
      if (err instanceof Error) {
        expect(err instanceof LockError).toBeTruthy();
        expect(err.message).toBe('Implement this in the subclass.');
        expect('code' in err && err.code === 'ENOIMPL').toBeTruthy();
      }
    }
  }

  it("`LockBase._incReantryCount()`を実装しないと未実装エラー.", async () => {
    testNotImpleMethod(() => {
      new TestLockBase().test_incReantryCount();
    });
  });

  it("`LockBase._decReantryCount()`を実装しないと未実装エラー.", async () => {
    testNotImpleMethod(() => {
      new TestLockBase().test_decReantryCount();
    });
  });

  it("`LockBase._onError()`で、codeを持たないエラーを指定すると、、、.", async () => {
    const tl = new TestLockBase();
    const operation = 'OP';
    const mon = tl.test_onError(new Error("test `LockBase._onError()`"), operation);
    expect(mon.cancelled).toBeTruthy();
    expect(typeof mon.id === 'string' && mon.id.length > 0).toBeTruthy()
    expect(mon.operation).toBe(operation)
    expect(mon.reason).toBe('ELOCK'); // 未指定時のデフォルトの理由
  });

  it("stack が undefined なら`Call stack: couldn't get.`を返す", () => {
    vi.spyOn(Error, 'captureStackTrace').mockImplementation((targetObject: object) => {});

    expect(getCallStack()).toBe(`Call stack: couldn't get.`);
  });

});


