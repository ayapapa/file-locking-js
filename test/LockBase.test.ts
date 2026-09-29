import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileLock, type FileLockConfig, LockError, type LockMonitor } from '../src/index.ts';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TestLock } from './FileLockTestCommon.ts'
import { getCallStack, isEqualObjectType, sleepAsync, sleepSync } from '../src/lib/Util.ts'

let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});

describe('LockBase and Util', () => {

  it("The reentrancy context is shared even when the lock instances are different.", () => {
    const als = LockBase["_als"] as AsyncLocalStorage<ReentrantContext>;
    const rc: ReentrantContext | undefined = als.getStore();
    const childContext: ReentrantContext = { heldLocks: new Map(rc?.heldLocks) };
    const contextId = 'text-context';
    childContext.heldLocks.set(contextId, { monitor: { cancelled: false } });
    als.run(childContext, () => {
      const key1 = 'testKey1', key2 = 'testKey2';
      const ins1 = TestLock.getLock(key1);
      const ins2 = TestLock.getLock(key2);
      expect(ins1 !== ins2).toBe(true);
      expect(ins1.getReentrantContext()?.heldLocks.has(contextId)).toBe(true);
      expect(ins2.getReentrantContext()?.heldLocks.has(contextId)).toBe(true);
    });
  });

  it("`sleepAsync()` sleeps for the specified duration.", async () => {
    const start = Date.now();
    await sleepAsync(100);

    const elapsed = Date.now() - start;
    // Verify that at least 99 ms have elapsed to account for margin of error.
    expect(elapsed).toBeGreaterThanOrEqual(99);
  });

  it("`sleepSync()` sleeps for the specified duration.", () => {
    const start = Date.now();
    sleepSync(100);
    
    const elapsed = Date.now() - start;
    // Verify that at least 99 ms have elapsed to account for margin of error.
    expect(elapsed).toBeGreaterThanOrEqual(99);
  });

  class TestLockBase extends LockBase {
    constructor() {
      super("Key");
    }

    async test_incReantryCount() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await this._incReantryCount({ _ownerId: "", _contextId: "" } as any);
    }

    async test_decReantryCount() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
       return await this._decReantryCount({ _ownerId: "", _contextId: "" } as any);
    }

    async test_acquire() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await this._acquire({ _ownerId: "", _contextId: "" } as any);
    }

    async test_release() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await this._release({ _ownerId: "", _contextId: "" } as any);
    }

    test_onError(err: Error, op: string) : LockMonitor {
      const opts = { _ownerId: "", _contextId: "" };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._onError(err, op, opts as any);
      return '_monitor' in opts ? opts._monitor as LockMonitor : { cancelled: false };
    }
  }

  async function testNotImpleMethod(cb: () => Promise<void>) {
    expect.assertions(3)
    try {
      await cb();
    }
    catch (err) {
      if (err instanceof Error) {
        expect(err instanceof LockError).toBeTruthy();
        expect(err.message).toBe('Implement this in the subclass.');
        expect('code' in err && err.code === 'ENOIMPL').toBeTruthy();
      }
    }
  }

  it("Failing to implement `LockBase._incReantryCount()` results in a `not implemented` error.", async () => {
    await testNotImpleMethod(async() => {
      await (new TestLockBase().test_incReantryCount());
    });
  });

  it("Failure to implement `LockBase._decReantryCount()` results in an `not implemented` error.", async () => {
    await testNotImpleMethod(async () => {
      await (new TestLockBase().test_decReantryCount());
    });
  });

  it("Failure to implement `LockBase._acquire()` results in an `not implemented` error.", async () => {
    await testNotImpleMethod(async () => {
      await (new TestLockBase().test_acquire());
    });
  });

  it("Failure to implement `LockBase._release()` results in an `not implemented` error.", async () => {
    await testNotImpleMethod(async () => {
      await (new TestLockBase().test_release());
    });
  });

  it("When you specify an error that does not have a code in `LockBase._onError()`.", () => {
    const tl = new TestLockBase();
    const operation = 'OP';
    const mon = tl.test_onError(new Error("test `LockBase._onError()`"), operation);
    expect(mon.cancelled).toBeTruthy();
    expect(typeof mon.id === 'string' && mon.id.length > 0).toBeTruthy()
    expect(mon.operation).toBe(operation)
    expect(mon.reason).toBe('ELOCK'); // Reason for the default when unspecified
  });

  it("If `stack` is undefined, return `Call stack: couldn't get.`", () => {
    vi.spyOn(Error, 'captureStackTrace').mockImplementation(() => {});

    expect(getCallStack()).toBe(`Call stack: couldn't get.`);
  });

  it("isEqualObjectType error", () => {
    expect(isEqualObjectType({ a: 123, b: "hello"}, { b: "hello", a: 123 })).toBeTruthy();
    expect(isEqualObjectType({ a: 123, b: "hello"}, { a: 123, b: "hello", c: new Error() })).toBeFalsy();
    expect(isEqualObjectType({ a: "goodbye", b: "hello"}, { a: 123, b: "hello" })).toBeFalsy();
  });

  it("Register Duplicate Termination Function", () => {
    expect.assertions(4);
    let count = 0;
    function onExit(code: unknown, signal: unknown): void {
      expect(code).toBe(0);
      expect(signal).toBe(null);
      count++;
    };
    const before = TestLock.getExitFuncs().length;
    TestLock.testAddOnExit(onExit);
    TestLock.testAddOnExit(onExit);
    expect(TestLock.getExitFuncs().length).toBe(before + 1);
    LockBase.onExit(0, null);
    expect(count).toBe(1);
  });

});


