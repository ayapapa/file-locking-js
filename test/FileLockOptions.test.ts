import { describe, expect, it } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLock, FileLockOptions, InvalidOptions } from '../src/index';
import { FileLockOptionsResolver } from '../src/lib/FileLockOptionsResolver';
import { AnyCnameRecord } from 'node:dns';
import { AsyncLocalStorage } from 'node:async_hooks';
import { LockError } from '../src/lib/LockBaseErrors';

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const logger = new PrettyConsole({ level: 'trace' });

FileLock.setConfig({ logger });

interface TestOpts {
  _resolvedOpts?: FileLockOptions
};

describe('FileLockOptions test.', () => {

  function testToBeSameAsTheDefaultOptions(opts: FileLockOptions): void {
    // Check basic options
    expect(opts.timeoutSec).toBeUndefined();
    expect(opts.timeoutMs).toBe(5000);
    expect(opts.ttlSec).toBeUndefined();
    expect(opts.ttlMs).toBe(10000);
    expect(opts.allowReentry).toBe(false);
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

  it("When the lock with no options, internally resolved options are same as the default options.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  {} as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
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
    const opts: FileLockOptions & TestOpts =  {timeoutSec : 1.2,  ttlSec: 1.00001, pollIntervalSec: 0.11, heartbeatIntervalSec: 1.1, heartbeatTimeoutSec: 10.002555, retryIntervalSec: 0.213};
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect(opts._resolvedOpts).toBeDefined();
    const defaultOpts = FileLock.getDefaultOptions();
    // Check basic options
    expect(opts._resolvedOpts?.timeoutSec).toBeUndefined();
    expect(opts._resolvedOpts?.timeoutMs).toBe(Math.floor((opts.timeoutSec ?? 0) * 1000)); 
    expect(opts._resolvedOpts?.ttlSec).toBeUndefined();
    expect(opts._resolvedOpts?.ttlMs).toBe(Math.floor((opts.ttlSec ?? 0) * 1000));
    expect(opts._resolvedOpts?.allowReentry).toBe(defaultOpts.allowReentry);
    // Check basic options
    expect(opts._resolvedOpts?.pollIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts?.pollIntervalMs).toBe(Math.floor((opts.pollIntervalSec ?? 0) * 1000));
    expect(opts._resolvedOpts?.heartbeatIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts?.heartbeatIntervalMs).toBe(Math.floor((opts.heartbeatIntervalSec ?? 0) * 1000));
    expect(opts._resolvedOpts?.heartbeatTimeoutSec).toBeUndefined();
    expect(opts._resolvedOpts?.heartbeatTimeoutMs).toBe(Math.floor((opts.heartbeatTimeoutSec ?? 0) * 1000));
    expect(opts._resolvedOpts?.retriesOnIOErr).toBe(defaultOpts.retriesOnIOErr);
    expect(opts._resolvedOpts?.retryIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts?.retryIntervalMs).toBe(Math.floor((opts.retryIntervalSec ?? 0) * 1000));
  });

  it("When the lock with options other than time-related ones,  internally resolved options are valid.", async () => {
    const retVal = "test_001", key = retVal;
    const opts =  { allowReentry: true, retriesOnIOErr: 2 } as any;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
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
  });

  async function testOptionConflicting(name: string, eMsg: string) {
    const retVal = "test_001", key = retVal;
    const opts =  {} as any;
    const keySec = `${name}Sec`;
    const keyMs  = `${name}Ms`;
    opts[keySec] = 1.5;
    opts[keyMs] = 2000;
    
    try {
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal
        },
        opts
      );
    }
    catch(err: any) {
      expect(err instanceof InvalidOptions).toBeTruthy();
      expect(err.code).toBe('EINVAL');
      expect(err.message).toContain(keyMs);
      expect(err.message).toContain(keySec);
      expect(err.message).toContain(eMsg);
    }
  }

  it("`InvalidOptions` error when specifying conflicting options(timeout).", async () => {
    await testOptionConflicting('timeout', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(ttl).", async () => {
    await testOptionConflicting('ttl', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(pollInterval).", async () => {
    await testOptionConflicting('pollInterval', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(heartbeatInterval).", async () => {
    await testOptionConflicting('heartbeatInterval', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(heartbeatTimeout).", async () => {
    await testOptionConflicting('heartbeatTimeout', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(retryInterval).", async () => {
    await testOptionConflicting('retryInterval', 'cannot be specified at the same time')
  });

  async function testTypeErrorOption(name: string, value: any, eMsg: string = 'The type of option') {
    const retVal = "test_001", key = retVal;
    const opts =  {} as any;
    opts[name] = value;
    
    try {
      await FileLock.withLock(key, 
        async () => {
          sleepAsync(500);
          return retVal
        },
        opts
      );
    }
    catch(err: any) {
      expect(err instanceof InvalidOptions).toBeTruthy();
      expect(err.code).toBe('EINVAL');
      expect(err.message).toContain(name);
      expect(err.message).toContain(eMsg);
    }
  }

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(timeoutSec).", async () => {
    await testTypeErrorOption('timeoutSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(timeoutMs).", async () => {
    await testTypeErrorOption('timeoutMs', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(ttlSec).", async () => {
    await testTypeErrorOption('ttlSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(ttlMs).", async () => {
    await testTypeErrorOption('ttlMs', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(pollIntervalSec).", async () => {
    await testTypeErrorOption('pollIntervalSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(pollIntervalMs).", async () => {
    await testTypeErrorOption('pollIntervalMs', 'string');
  });
  
  it("An `InvalidOptions` error occurs when an option value of a different type is specified(heartbeatIntervalSec).", async () => {
    await testTypeErrorOption('heartbeatIntervalSec', 'string');
  });
  
  it("An `InvalidOptions` error occurs when an option value of a different type is specified(heartbeatIntervalMs).", async () => {
    await testTypeErrorOption('heartbeatIntervalMs', 'string');
  });
  
  it("An `InvalidOptions` error occurs when an option value of a different type is specified(heartbeatTimeoutSec).", async () => {
    await testTypeErrorOption('heartbeatTimeoutSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(heartbeatTimeoutMs).", async () => {
    await testTypeErrorOption('heartbeatTimeoutMs', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(retryIntervalSec).", async () => {
    await testTypeErrorOption('retryIntervalSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(retryIntervalMs).", async () => {
    await testTypeErrorOption('retryIntervalMs', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(allowReentry).", async () => {
    await testTypeErrorOption('allowReentry', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(retriesOnIOErr).", async () => {
    await testTypeErrorOption('retriesOnIOErr', 'string');
  });

  function testNullKindValueOption(key: keyof FileLockOptions, value: undefined | null) {
    const options: FileLockOptions = {};
    // テストのため強制型キャスト
    options[key] = value as any;
    expect(() => new FileLockOptionsResolver(options)).toThrow(InvalidOptions);
  }

  it("undefinedやnullを指定すると、エラーになる(timeoutSec).", async () => {
    testNullKindValueOption('timeoutSec', null);
    testNullKindValueOption('timeoutSec', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(timeoutMs).", async () => {
    testNullKindValueOption('timeoutMs', null);
    testNullKindValueOption('timeoutMs', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(ttlSec).", async () => {
    testNullKindValueOption('ttlSec', null);
    testNullKindValueOption('ttlSec', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(ttlMs).", async () => {
    testNullKindValueOption('ttlMs', null);
    testNullKindValueOption('ttlMs', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(allowReentry).", async () => {
    testNullKindValueOption('allowReentry', null);
    testNullKindValueOption('allowReentry', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(pollIntervalSec).", async () => {
    testNullKindValueOption('pollIntervalSec', null);
    testNullKindValueOption('pollIntervalSec', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(pollIntervalMs).", async () => {
    testNullKindValueOption('pollIntervalMs', null);
    testNullKindValueOption('pollIntervalMs', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(heartbeatIntervalSec).", async () => {
    testNullKindValueOption('heartbeatIntervalSec', null);
    testNullKindValueOption('heartbeatIntervalSec', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(heartbeatIntervalMs).", async () => {
    testNullKindValueOption('heartbeatIntervalMs', null);
    testNullKindValueOption('heartbeatIntervalMs', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(heartbeatTimeoutSec).", async () => {
    testNullKindValueOption('heartbeatTimeoutSec', null);
    testNullKindValueOption('heartbeatTimeoutSec', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(heartbeatTimeoutMs).", async () => {
    testNullKindValueOption('heartbeatTimeoutMs', null);
    testNullKindValueOption('heartbeatTimeoutMs', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(retriesOnIOErr).", async () => {
    testNullKindValueOption('retriesOnIOErr', null);
    testNullKindValueOption('retriesOnIOErr', undefined);
  });
  
  it("undefinedやnullを指定すると、エラーになる(retryIntervalSec).", async () => {
    testNullKindValueOption('retryIntervalSec', null);
    testNullKindValueOption('retryIntervalSec', undefined);
  });

  it("undefinedやnullを指定すると、エラーになる(retryIntervalMs).", async () => {
    testNullKindValueOption('retryIntervalMs', null);
    testNullKindValueOption('retryIntervalMs', undefined);
  });

  it("解決済のoptionを変更して、再度解決すると、その結果が正しく反映されている.", async () => {
    const options: FileLockOptions & {[_resolvedOpts: string]: FileLockOptions} = {};
    const rOpts = new FileLockOptionsResolver(options).getOptions();
    options.allowReentry = true;
    const rOpts2 = new FileLockOptionsResolver(options).getOptions()
    expect(rOpts2.allowReentry).toBe(options.allowReentry);
    expect('_resolvedOpts' in options ? options._resolvedOpts?.allowReentry : 'error').toBe(options.allowReentry);
  });

  //FileLockOptionsResolver
/*
  it("An `InvalidOptions` error occurs when an option value of a different type is specified(retriesOnIOErr).", async () => {
    await testTypeErrorOption('retriesOnIOErr', 'string');
  });
*/

});
