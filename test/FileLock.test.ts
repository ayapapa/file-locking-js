import { describe, expect, it, vi, type Mock } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLock, FileLockUserOptions, LogProvider } from '../src/index';
async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('FileLock', () => {

  function testToBeSameAsTheDefaultOptions(opts: FileLockUserOptions): void {
    // Check basic options
    expect(opts.timeoutSec).toBeUndefined();
    expect(opts.timeoutMs).toBe(5000);
    expect(opts.ttlSec).toBeUndefined();
    expect(opts.ttlMs).toBe(10000);
    expect(opts.allowReentry).toBe(false);
    expect(opts.logger).toBe(console); // default
    // Check basic options
    expect(opts.pollIntervalSec).toBeUndefined();
    expect(opts.pollIntervalMs).toBe(100);
    expect(opts.heartbeatIntervalSec).toBeUndefined();
    expect(opts.heartbeatIntervalMs).toBe(1000);
    expect(opts.heartbeatTimeoutSec).toBeUndefined();
    expect(opts.heartbeatTimeoutMs).toBe(10000);
    expect(opts.retriesOnIOErr).toBe(1);
    expect(opts.retryIntervalSec).toBeUndefined();
    expect(opts.retryIntervalMs).toBe(100);
  }

  it("Default options are valid.", async () => {
    testToBeSameAsTheDefaultOptions(FileLock.getDefaultOptions());
  });

  it("The lock is successfully acquired, and the return value of the callback is obtained.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {timeoutSec : 1 } as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(3000);
        return retVal
      },
      opts
    )).toBe(retVal);
  });

  it("When the lock with no options, internally resolved options are same as the default options.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {} as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(3000);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    testToBeSameAsTheDefaultOptions(opts._resolvedOpts);
  });

  it("When the lock with xxxSec options only,  internally resolved options have valid calculated xxxMs properties.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {timeoutSec : 1.2,  ttlSec: 1.00001, pollIntervalSec: 0.11, heartbeatIntervalSec: 1.1, heartbeatTimeoutSec: 10.002555, retryIntervalSec: 0.213} as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(3000);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    const defaultOpts = FileLock.getDefaultOptions();
    // Check basic options
    expect(opts._resolvedOpts.timeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.timeoutMs).toBe(Math.floor(opts.timeoutSec * 1000)); 
    expect(opts._resolvedOpts.ttlSec).toBeUndefined();
    expect(opts._resolvedOpts.ttlMs).toBe(Math.floor(opts.ttlSec * 1000));
    expect(opts._resolvedOpts.allowReentry).toBe(defaultOpts.allowReentry);
    expect(opts._resolvedOpts.logger).toBe(defaultOpts.logger);
    // Check basic options
    expect(opts._resolvedOpts.pollIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.pollIntervalMs).toBe(Math.floor(opts.pollIntervalSec * 1000));
    expect(opts._resolvedOpts.heartbeatIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatIntervalMs).toBe(Math.floor(opts.heartbeatIntervalSec * 1000));
    expect(opts._resolvedOpts.heartbeatTimeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatTimeoutMs).toBe(Math.floor(opts.heartbeatTimeoutSec * 1000));
    expect(opts._resolvedOpts.retriesOnIOErr).toBe(defaultOpts.retriesOnIOErr);
    expect(opts._resolvedOpts.retryIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.retryIntervalMs).toBe(Math.floor(opts.retryIntervalSec * 1000));
    expect(opts._resolvedOpts.resolved).toBe(true);
  });

  it("When the lock with options other than time-related ones,  internally resolved options are valid.", async () => {
    const retVal = "test_001", key = retVal;
    const logger: LogProvider = new PrettyConsole();
    const it = typeof logger;
    const opts =  { allowReentry: true, logger: logger, retriesOnIOErr: 2 } as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(3000);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    const defaultOpts = FileLock.getDefaultOptions();
    // Check basic options
    expect(opts._resolvedOpts.timeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.timeoutMs).toBe(defaultOpts.timeoutMs);
    expect(opts._resolvedOpts.ttlSec).toBeUndefined();
    expect(opts._resolvedOpts.ttlMs).toBe(defaultOpts.ttlMs);
    expect(opts._resolvedOpts.allowReentry).toBe(opts.allowReentry);
    expect(opts._resolvedOpts.logger).toBe(opts.logger);
    // Check basic options
    expect(opts._resolvedOpts.pollIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.pollIntervalMs).toBe(defaultOpts.pollIntervalMs);
    expect(opts._resolvedOpts.heartbeatIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatIntervalMs).toBe(defaultOpts.heartbeatIntervalMs);
    expect(opts._resolvedOpts.heartbeatTimeoutSec).toBeUndefined();
    expect(opts._resolvedOpts.heartbeatTimeoutMs).toBe(defaultOpts.heartbeatTimeoutMs);
    expect(opts._resolvedOpts.retriesOnIOErr).toBe(opts.retriesOnIOErr);
    expect(opts._resolvedOpts.retryIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts.retryIntervalMs).toBe(defaultOpts.retryIntervalMs);
    expect(opts._resolvedOpts.resolved).toBe(true);
  });

  /*
  it("test_InterProcessLock_success"), () => {
    // 非同期で3秒スリープする関数を、別キーで複数回呼び出してみる
    const a =  FileLock.withLock("testKey1", 
      async () => {
        await sleepAsync(3000);
      },
      {timeoutSec : 1 }
    );
    
    const b =  FileLock.withLock("testKey2", 
      async () => {
        await sleepAsync(3000);
      },
      {timeoutSec : 1 }
    );
    let res;
    expect(res = await Promise.all([a, b])).toHaveLength(2);
    expect(res[0]).toBeUndefined();
    expect(res[1]).toBeUndefined();
  }
*/
});
