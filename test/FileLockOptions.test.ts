import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileLock, type FileLockConfig, type FileLockOptions, InvalidOptions } from '../src/index.ts';
import { FileLockOptionsResolver } from '../src/lib/FileLockOptionsResolver.ts';
import { type FileLockRequiredOptions, minimumFileLockOptions } from '../src/lib/FileLockOptions.ts';
import { type OptionsForTesting } from '../src/lib/AllOptions.ts'

let orgConfig: FileLockConfig;
beforeEach(() => {
  vi.restoreAllMocks();
  orgConfig = FileLock.getConfig();
});

afterEach(() => {
  vi.restoreAllMocks();
  FileLock.setConfig(orgConfig);
});

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type TestOpts = OptionsForTesting<FileLockOptions>;

describe('FileLockOptions test.', () => {

  function testToBeSameAsTheDefaultOptions(opts: FileLockOptions): void {
    // Check basic options
    expect(opts.timeoutSec).toBeUndefined();
    expect(opts.timeoutMs).toBe(5000);
    expect(opts.ttlSec).toBeUndefined();
    expect(opts.ttlMs).toBe(5000);
    expect(opts.allowReentry).toBe(false);
    // Check basic options
    expect(opts.pollIntervalSec).toBeUndefined();
    expect(opts.pollIntervalMs).toBe(100);
    expect(opts.heartbeatIntervalSec).toBeUndefined();
    expect(opts.heartbeatIntervalMs).toBe(1000);
    expect(opts.heartbeatTtlSec).toBeUndefined();
    expect(opts.heartbeatTtlMs).toBe(2000);
    expect(opts.retriesOnIOErr).toBe(1);
    expect(opts.retryIntervalSec).toBeUndefined();
    expect(opts.retryIntervalMs).toBe(100);
    expect(opts.invalidTtlSec).toBeUndefined();
    expect(opts.invalidTtlMs).toBeUndefined();
  }

  it("Default options are valid.", () => {
    testToBeSameAsTheDefaultOptions(FileLock.getDefaultOptions());
  });

  it("When the lock with no options, internally resolved options are same as the default options.", async () => {
    const retVal = "noOpts", key = retVal;
    const opts =  {} as FileLockOptions;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect('_resolvedOpts' in opts).toBeTruthy();
    if ('_resolvedOpts' in opts) {
      const resolved = opts._resolvedOpts as FileLockOptions;
      testToBeSameAsTheDefaultOptions(resolved);
    }
  });

  it("When the lock with xxxSec options only,  internally resolved options have valid calculated xxxMs properties.", async () => {
    const retVal = "xxxSecOnlyOpts", key = retVal;
    const opts: FileLockOptions & TestOpts =  {
      timeoutSec : 1.2,  ttlSec: 1.00001, pollIntervalSec: 0.11, 
      heartbeatIntervalSec: 1.1, heartbeatTtlSec: 10.002555, retryIntervalSec: 0.213,
      invalidTtlSec : 11.0};
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
    expect(opts._resolvedOpts?.heartbeatTtlSec).toBeUndefined();
    expect(opts._resolvedOpts?.heartbeatTtlMs).toBe(Math.floor((opts.heartbeatTtlSec ?? 0) * 1000));
    expect(opts._resolvedOpts?.retriesOnIOErr).toBe(defaultOpts.retriesOnIOErr);
    expect(opts._resolvedOpts?.retryIntervalSec).toBeUndefined();
    expect(opts._resolvedOpts?.retryIntervalMs).toBe(Math.floor((opts.retryIntervalSec ?? 0) * 1000));
    expect(opts._resolvedOpts?.invalidTtlSec).toBeUndefined();
    expect(opts._resolvedOpts?.invalidTtlMs).toBe(Math.floor((opts.invalidTtlSec ?? 0) * 1000));
  });

  it("When the lock with options other than time-related ones,  internally resolved options are valid.", async () => {
    const retVal = "noTimeRelatedOpts", key = retVal;
    const opts =  { allowReentry: true, retriesOnIOErr: 2 } as FileLockOptions;
    expect(await FileLock.withLock(key, 
      async () => {
        await sleepAsync(500);
        return retVal
      },
      opts
    )).toBe(retVal);
    // Check options resolved internally.
    expect('_resolvedOpts' in opts).toBeTruthy();
    const defaultOpts = FileLock.getDefaultOptions();
    // Check basic options
    if ('_resolvedOpts' in opts) {
      const resolved = opts._resolvedOpts as FileLockOptions;
      expect(resolved.timeoutSec).toBeUndefined();
      expect(resolved.timeoutMs).toBe(defaultOpts.timeoutMs);
      expect(resolved.ttlSec).toBeUndefined();
      expect(resolved.ttlMs).toBe(defaultOpts.ttlMs);
      expect(resolved.allowReentry).toBe(opts.allowReentry);
      // Check basic options
      expect(resolved.pollIntervalSec).toBeUndefined();
      expect(resolved.pollIntervalMs).toBe(defaultOpts.pollIntervalMs);
      expect(resolved.heartbeatIntervalSec).toBeUndefined();
      expect(resolved.heartbeatIntervalMs).toBe(defaultOpts.heartbeatIntervalMs);
      expect(resolved.heartbeatTtlSec).toBeUndefined();
      expect(resolved.heartbeatTtlMs).toBe(defaultOpts.heartbeatTtlMs);
      expect(resolved.retriesOnIOErr).toBe(opts.retriesOnIOErr);
      expect(resolved.retryIntervalSec).toBeUndefined();
      expect(resolved.retryIntervalMs).toBe(defaultOpts.retryIntervalMs);
      expect(resolved.invalidTtlSec).toBeUndefined();
      expect(resolved.invalidTtlMs).toBeUndefined();
    }
  });

  let count = 0;

  // 同時指定不可テスト
  async function testOptionConflicting(name: string, eMsg: string) {
    const retVal = "testOptionConflicting_" + String(count++).padStart(2, '0'), key = retVal;
    const opts =  {} as Record<string, number>;
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
    catch(err) {
      expect(err).instanceOf(InvalidOptions);
      expect(err).toMatchObject( { code: 'EINVAL' });
      if (err instanceof Error) {
        expect(err.message).toContain(keyMs);
        expect(err.message).toContain(keySec);
        expect(err.message).toContain(eMsg);
      }
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

  it("`InvalidOptions` error when specifying conflicting options(heartbeatTtl).", async () => {
    await testOptionConflicting('heartbeatTtl', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(retryInterval).", async () => {
    await testOptionConflicting('retryInterval', 'cannot be specified at the same time')
  });

  it("`InvalidOptions` error when specifying conflicting options(retryInterval).", async () => {
    await testOptionConflicting('invalidTtl', 'cannot be specified at the same time')
  });

  // type error test.
  async function testTypeErrorOption(name: string, value: unknown, eMsg: string = 'The type of option') {
    count = 0;
    const retVal = "testTypeErrorOption_" + String(count++).padStart(2, '0'), key = retVal;
    const opts =  {} as Record<string, unknown>;
    opts[name] = value;
    
    try {
      await FileLock.withLock(key, 
        async () => {
          await sleepAsync(500);
          return retVal
        },
        opts
      );
    }
    catch(err) {
      expect(err).instanceOf(InvalidOptions);
      expect(err).toMatchObject({ code: 'EINVAL' });
      if (err instanceof Error) {
        expect(err.message).toContain(name);
        expect(err.message).toContain(eMsg);
      }
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
  
  it("An `InvalidOptions` error occurs when an option value of a different type is specified(heartbeatTtlSec).", async () => {
    await testTypeErrorOption('heartbeatTtlSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(heartbeatTtlMs).", async () => {
    await testTypeErrorOption('heartbeatTtlMs', 'string');
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

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(invalidTtlSec).", async () => {
    await testTypeErrorOption('invalidTtlSec', 'string');
  });

  it("An `InvalidOptions` error occurs when an option value of a different type is specified(invalidTtlMs).", async () => {
    await testTypeErrorOption('invalidTtlMs', 'string');
  });

  // null系指定が許可されていないオプションのnull系指定エラーテスト
  function _testNullKindValueOption(key: keyof FileLockOptions, value: undefined | null) {
    const options: FileLockOptions = {};
    const addedOpt = {} as Record<string, unknown>;
    addedOpt[key] = value;
    // テストのため強制型キャスト
    Object.assign(options, addedOpt);
    try {
      new FileLockOptionsResolver(options, minimumFileLockOptions);
    }
    catch (err) {
      expect(err).toBeInstanceOf(InvalidOptions);
      expect(err).toMatchObject({ code: 'EINVAL', name: key, message: `[REQUIRE] The type of option ${key} is incorrect.` })
    }
  }

  // null系指定が許可されていないオプションのnull系指定エラーテスト
  function testNullKindValueOption(key: keyof FileLockOptions) {
    expect.assertions(4);
    _testNullKindValueOption(key, null);
    _testNullKindValueOption(key, undefined);
  }

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(timeoutSec).", () => {
    testNullKindValueOption('timeoutSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(timeoutMs).", () => {
    testNullKindValueOption('timeoutMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(ttlSec).", () => {
    testNullKindValueOption('ttlSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(ttlMs).", () => {
    testNullKindValueOption('ttlMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(allowReentry).", () => {
    testNullKindValueOption('allowReentry')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(pollIntervalSec).", () => {
    testNullKindValueOption('pollIntervalSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(pollIntervalMs).", () => {
    testNullKindValueOption('pollIntervalMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatIntervalSec).", () => {
    testNullKindValueOption('heartbeatIntervalSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatIntervalMs).", () => {
    testNullKindValueOption('heartbeatIntervalMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatTtlSec).", () => {
    testNullKindValueOption('heartbeatTtlSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(heartbeatTtlMs).", () => {
    testNullKindValueOption('heartbeatTtlMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(retriesOnIOErr).", () => {
    testNullKindValueOption('retriesOnIOErr')
  });
  
  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(retryIntervalSec).", () => {
    testNullKindValueOption('retryIntervalSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(retryIntervalMs).", () => {
    testNullKindValueOption('retryIntervalMs')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(invalidTtlSec).", () => {
    testNullKindValueOption('invalidTtlSec')
  });

  it("Specifying `undefined` or `null` as an option property value passed to `new FileLockOptionsResolver()` results in an error.(invalidTtlMs).", () => {
    testNullKindValueOption('invalidTtlMs')
  });

  it("When a resolved option is modified and resolved again, the result is correctly reflected.", () => {
    const options: FileLockOptions & {[_resolvedOpts: string]: FileLockOptions} = {};
    options.allowReentry = true;
    const rOpts1 = new FileLockOptionsResolver(options, minimumFileLockOptions).getOptions()
    expect(rOpts1.allowReentry).toBe(options.allowReentry);
    expect('_resolvedOpts' in options && options._resolvedOpts.allowReentry === rOpts1.allowReentry).toBeTruthy();
    options._resolvedOpts.allowReentry = false;
    expect('_resolvedOpts' in options && options._resolvedOpts.allowReentry === rOpts1.allowReentry).toBeTruthy();
    expect(options.allowReentry).toBe(true);
    expect(options._resolvedOpts.allowReentry).toBe(false);

    // もう一度、同じoptions(_resolvedOpts付き)を解決すると、
    // _resolvedOptsは、options.allowReentryと同じ値になっているはず。
    const rOpts2 = new FileLockOptionsResolver(options, minimumFileLockOptions).getOptions()
    expect(rOpts2.allowReentry).toBe(options.allowReentry);
    expect('_resolvedOpts' in options ? options._resolvedOpts?.allowReentry : "hoge").toBe(options.allowReentry);
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
      delete this.defaultOptions;// = undefined;
      return super.getRequiredOptions();
    }
  }

  it("Calling `getRequiredOptions()` results in an error if an option lacks a required property and no default options have been specified.", () => {
    const or = new TestOptionResolver({}, FileLock.getDefaultOptions());
    expect.assertions(2);
    try {
      or.test_getRequiredOptions_emptyOpts();
    }
    catch (err) {
      expect(err).instanceOf(InvalidOptions);
      expect(err).toMatchObject( {
        code: 'EINVAL', 
        message: "Missing required option: timeoutMs,ttlMs,allowReentry,pollIntervalMs,heartbeatIntervalMs,heartbeatTtlMs,retriesOnIOErr,retryIntervalMs"
      })
    }
  });

  it("Calling getRequiredOptions() without specifying default options results in an error.", () => {
    const optionResolver = new TestOptionResolver({}, FileLock.getDefaultOptions());
    expect.assertions(2);
    try {
      optionResolver.test_getRequiredOptions_noDefaults();
    }
    catch (err) {
      expect(err).instanceOf(InvalidOptions);
      expect(err).toMatchObject( {
        code: 'EINVAL', 
        name: "this.defaultOptions",
        message: "[REQUIRE] To generate required options, specify `defaultOptions` in the constructor."
      })
    }
  });

  it("If a value less than the minimum is specified for a numeric option, the minimum value is set.", async () => {
    const opts: FileLockOptions = {
      timeoutMs:            -1,
      ttlMs:                -1,
      pollIntervalMs:       -1,
      heartbeatIntervalMs:  -1,
      heartbeatTtlMs:       -1,
      retriesOnIOErr:       -1,
      retryIntervalMs:      -1,
      invalidTtlMs:         -1,
    };
    const exp = {
      allowReentry:         false,
      timeoutMs:            0,
      ttlMs:                1000,
      pollIntervalMs:       100,
      heartbeatIntervalMs:  1000,
      heartbeatTtlMs:       2000,
      retriesOnIOErr:       0,
      retryIntervalMs:      100,
      invalidTtlMs:         2000,
    };

    await FileLock.withLock('testKey8989', () => {}, opts);
    
    expect('_resolvedOpts' in opts).toBeTruthy();
    expect('_resolvedOpts' in opts && opts['_resolvedOpts']).toMatchObject(exp);
  });

});
