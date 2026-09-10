import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLock, FileLockConfig, FileLockError, FileLockOptions, InvalidOptions } from '../src/index';
import { FileLockOptionsResolver } from '../src/lib/FileLockOptionsResolver';
import { AnyCnameRecord } from 'node:dns';
import { AsyncLocalStorage } from 'node:async_hooks';
import { LockError } from '../src/lib/LockBaseErrors';
import { FileLockRequiredOptions, minimumFileLockOptions } from '../src/lib/FileLockOptions';
import { TestLock } from './FileLockTestCommon';

let orgConfig: FileLockConfig;
beforeEach(() => {
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  FileLock.setConfig(orgConfig);
  vi.restoreAllMocks();
});

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  function _testNullKindValueOption(key: keyof FileLockOptions, value: undefined | null) {
    const options: FileLockOptions = {};
    // テストのため強制型キャスト
    options[key] = value as any;
    try {
      new FileLockOptionsResolver(options, minimumFileLockOptions);
    }
    catch (err) {
      expect(err).toBeInstanceOf(InvalidOptions);
      expect(err).toMatchObject({ code: 'EINVAL', name: key, message: `[REQUIRE] The type of option ${key} is incorrect.` })
    }
  }

  function testNullKindValueOption(key: keyof FileLockOptions) {
    expect.assertions(4);
    _testNullKindValueOption(key, null);
    _testNullKindValueOption(key, undefined);
  }
  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(timeoutSec).", async () => {
    testNullKindValueOption('timeoutSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(timeoutMs).", async () => {
    testNullKindValueOption('timeoutMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(ttlSec).", async () => {
    testNullKindValueOption('ttlSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(ttlMs).", async () => {
    testNullKindValueOption('ttlMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(allowReentry).", async () => {
    testNullKindValueOption('allowReentry')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(pollIntervalSec).", async () => {
    testNullKindValueOption('pollIntervalSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(pollIntervalMs).", async () => {
    testNullKindValueOption('pollIntervalMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatIntervalSec).", async () => {
    testNullKindValueOption('heartbeatIntervalSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatIntervalMs).", async () => {
    testNullKindValueOption('heartbeatIntervalMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatTimeoutSec).", async () => {
    testNullKindValueOption('heartbeatTimeoutSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatTimeoutMs).", async () => {
    testNullKindValueOption('heartbeatTimeoutMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(retriesOnIOErr).", async () => {
    testNullKindValueOption('retriesOnIOErr')
  });
  
  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(retryIntervalSec).", async () => {
    testNullKindValueOption('retryIntervalSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(retryIntervalMs).", async () => {
    testNullKindValueOption('timeoutSec')
  });

  it("When a resolved option is modified and resolved again, the result is correctly reflected.", async () => {
    const options: FileLockOptions & {[_resolvedOpts: string]: FileLockOptions} = {};
    const rOpts = new FileLockOptionsResolver(options, minimumFileLockOptions).getOptions();
    options.allowReentry = true;
    const rOpts2 = new FileLockOptionsResolver(options, minimumFileLockOptions).getOptions()
    expect(rOpts2.allowReentry).toBe(options.allowReentry);
    expect('_resolvedOpts' in options ? options._resolvedOpts?.allowReentry : 'error').toBe(options.allowReentry);
  });

  //FileLockOptionsResolver
  class TestOptionResolver extends FileLockOptionsResolver {
    constructor(options: FileLockOptions, defaultOpts: FileLockRequiredOptions) {
      super(options, minimumFileLockOptions, defaultOpts);
    }

    public test_getRequiredOptions_emptyOpts() {
      this.options = {};
      return super.getRequiredOptions();
    }

    public test_getRequiredOptions_noDefaults() {
      this.defaultOptions = undefined;
      return super.getRequiredOptions();
    }
  }

  it("Calling `getRequiredOptions()` results in an error if an option lacks a required property and no default options have been specified.", async () => {
    const or = new TestOptionResolver({}, FileLock.getDefaultOptions());
    expect.assertions(2);
    try {
      or.test_getRequiredOptions_emptyOpts();
    }
    catch (err) {
      expect(err).instanceOf(InvalidOptions);
      expect(err).toMatchObject( {
        code: 'EINVAL', 
        message: "Missing required option: timeoutMs,ttlMs,allowReentry,pollIntervalMs,heartbeatIntervalMs,heartbeatTimeoutMs,retriesOnIOErr,retryIntervalMs"
      })
    }
  });

  it("Calling getRequiredOptions() without specifying default options results in an error.", async () => {
    const or = new TestOptionResolver({}, FileLock.getDefaultOptions());
    expect.assertions(2);
    try {
      or.test_getRequiredOptions_noDefaults();
    }
    catch (err) {
      expect(err).instanceOf(InvalidOptions);
      expect(err).toMatchObject( {
        code: 'EINVAL', 
        message: "To generate required options, specify `defaultOptions` in the constructor."
      })
    }
  });

  it("If a value less than the minimum is specified for a numeric option, the minimum value is set.", async () => {
    const opts = {
      timeoutMs:            -1,
      ttlMs:                -1,
      pollIntervalMs:       -1,
      heartbeatIntervalMs:  -1,
      heartbeatTimeoutMs:   -1,
      retriesOnIOErr:       -1,
      retryIntervalMs:      -1,
    };
    const exp = {
      timeoutMs:            0,
      ttlMs:                1000,
      pollIntervalMs:       100,
      heartbeatIntervalMs:  1000,
      heartbeatTimeoutMs:   2000,
      retriesOnIOErr:       0,
      retryIntervalMs:      100,
    };

    FileLock.withLock('testKey8989', () => {}, opts);
    expect(TestLock._lastOptions).toMatchObject(exp);
  });

});
