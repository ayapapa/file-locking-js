import { AsyncLocalStorage } from 'node:async_hooks';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { LockError, DeadlockDetected, TTLExceeded } from './LockBaseErrors.ts';
import { type AllOptions } from './AllOptions.ts';
import { type LockBaseRequiredOptions } from './LockBaseOptions.ts';
import { type LockBaseInternalState, type Monitor } from './LockBaseInternalState.ts'
import { defaultLockBaseConfig, type LockBaseConfig, type LogProvider } from './LockBaseConfig.ts'
import { isEqualObject } from './Util.ts';

const {REQUIRE_DEBUG} = Contracts;

/** Definition of the callback function to be executed after acquiring the lock. */
export type CallbackOnLock = (monitor: Monitor) => any;

export type LogProviderInternal = Required<LogProvider>;

/** 
 * @internal
 * Context object for reentrancy lock detection.
 */
export interface ReentrantContext  {
  /** Set of reentrant context ids */
  heldLocks: Map<string, { monitor: Monitor }>;
}

/**
 * @internal
 * Base class for implementing mutual exclusion (locking). 
 * Uses AsyncLocalStorage to prevent re-entrant locking issues. 
 *
 * Note: Preventing re-entrant locking via AsyncLocalStorage is effective
 * only within the same asynchronous context in the same Node process. 
 * It does not extend to controlling re-entrancy across processes launched
 * from within that context.
 * @abstract
 */
export class LockBase <O extends LockBaseRequiredOptions = LockBaseRequiredOptions, I extends LockBaseInternalState = LockBaseInternalState>  {

  /** 
   * Static fieilds. 
   */
  
  /**
   * @internal
   * AsyncLocalStorage. 
   * Used for reentrant lock detection.
   * Since the goal is to share reentrancy context information (via `getStore()`) regardless of the specific instance, 
   * it is implemented as a static property to enable sharing across instances.  
   */
  private static _als: AsyncLocalStorage<ReentrantContext> = new AsyncLocalStorage<ReentrantContext>();

  /**
   * Static methods.
   */

  protected static _copyConfig<T extends LockBaseConfig>(config: T): T {
    const ret = { ...config };
    //if (config.defaultOptions) ret.defaultOptions = { ...config.defaultOptions };
    // If specified undefined, delete it.
    for (let key in ret) {
      if (ret[key] === undefined) delete ret[key];
    }
    return ret;
  }
/*
  protected static getDefaultConfig() {
    return LockBase._copyConfig(defaultLockBaseConfig);
  }
*/
  protected static _config: Required<LockBaseConfig> = { ...defaultLockBaseConfig };//LockBase.getDefaultConfig();

  protected static _logger =  LockBase._resolveLogger(LockBase._config);

  protected static setConfig(config: LockBaseConfig): void {
    REQUIRE_DEBUG(isEqualObject(LockBase._config, defaultLockBaseConfig),
      '現在のコンフィグが不正です。（不具合）', LockError, { code: 'EINVAL' });
    // 型の検証済みのため、型キャストする
    const curConf = LockBase._config as Record<string, unknown>;
    const newConf = config as Record<string, unknown>;
    Object.keys(curConf).forEach(key => {
      if (key in newConf) curConf[key] = newConf[key];
    });
    //const dConf = LockBase._copyConfig(config);
    //LockBase._config = { ...LockBase._config, ...dConf };
    /*
    if ('_debug' in config) LockBase._config['_debug'] = config['_debug'];
    if ('logger' in config) LockBase._config['logger'] = config['logger'];
    */
    // logger
    LockBase._logger = LockBase._resolveLogger(LockBase._config);

    // debug
    Contracts.setConfig({ debug: LockBase._config._debug, logger: LockBase._logger });
  }
  

  /**
   * @internal
   * @param config 
   * @returns 全てのメソッドが必須のロガー
   */
  protected static _resolveLogger(config?: LockBaseConfig): Required<LogProvider> {
    let logger: LogProvider = config?.logger ?? console
    if (logger === console) {
      logger = {...console as LogProvider};
      logger.trace = logger.debug;
    }
    // There are cases where 'fatal' is not present; in such instances, use 'error'.
    if (!logger.fatal) logger.fatal = logger.error;
    // Make `fatal` mandatory.
    return logger as Required<LogProvider>;
  }

  /** 
   * Instance fieilds. 
   */

  /**
   * @internal
   *  Logger.
   */
  protected _logger: Required<LogProvider>;

  /** 
   * @internal
   * Lock key
   */
  protected _key: string;

  /**
   * @internal
   * Function that signals a forced termination.
   */
  #onExitReject: ((reason?: unknown) => void) | null = null;

  /** Instance methods. */

  /**
   * @internal
   * Constructor.
   * @param key     Lock key.
   * @param config  Configuration.
   */
  protected constructor(key: string, config?: LockBaseConfig) {
    this._key = key;
    this._logger = LockBase._resolveLogger(config);
  }

  /**
   * @internal
   * Acquires a lock for the specified key,
   * executes the function `onLockFn` under exclusive control, and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.
   *
   * @param onLockFn      A user-specified callback function to be executed after acquiring the lock.
   * @param execWithLock  The callback function that actually executes `withLock`.  
   * @param options       Options.
   * @returns A `Promise` that resolves with the return value of `onLockFn`.
   * @abstract
   */
  protected async _withLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    REQUIRE_DEBUG(onLockFn && typeof onLockFn === 'function', 'Invalid onLockFn.', LockError, {code: 'EINVAL'});

    const whithLockInContext = async () => {
      // Preparing for recursive lock checks.
      const rc = this._getReentrantContext();
      if (!rc) {
        // Since there is no context for reentrancy lock detection yet, I will create a new context and call `withLock` again within it.
        return this.#runInNewContext(() => whithLockInContext());
      }

      // Re-entry lock check.
      if (this.#isReentry(options)) {
        // Error if reentrant locks are not permitted.
        if (!options.allowReentry) throw new DeadlockDetected(null, { key: this._key });

        // Since re-entry is permitted, increment the lock count and then execute the callback.
        this._logger.trace("Allow re-entry locks in accordance with `options.allowReentry`.");
        return this.#execWithoutLock(onLockFn, options)
      }

      // Exeute locking operations.
      return this.#execWithLock(onLockFn, options);
    }
    
    try {
      return await whithLockInContext();
    }
    catch (err) {
      this._logger.fatal('Error occurred.', err);
      throw err;
    }
  }

  protected async _acquire(options: AllOptions<O, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  protected async _release(options: AllOptions<O, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * 終了時処理。
   * Windows版では、強制終了(process.kill())からは呼び出されることは無いが、本実装は残しておく。
   */
  protected _onExit(code: number | null | undefined, signal: NodeJS.Signals | null) {
    this.#onExitReject && 
      this.#onExitReject(new LockError("Forced termination.", {
        code: 'ETERM',
        props: { exitReason: { code, signal } }
      }));
  }

  #createTtlTimer(options: AllOptions<O, I>): { id: NodeJS.Timeout | null, promise: Promise<any> } {
    let id: NodeJS.Timeout | null = null;
    const ttlMs = options.ttlMs;
    const promise = new Promise((_, reject) => {
      id = setTimeout(() => {
        reject(new TTLExceeded(null, { ttlMs, props: { key: this._key } }));
      },
      ttlMs);
    });
    return { id, promise };
  }

  async #execLockCommon(onLockFn: CallbackOnLock, aquire: () => Promise<void>, 
    release: () => Promise<void>, errMsg: string, options: AllOptions<O, I>) {
    // Acquire the lock.
    await aquire();

    // Created promises.
    const ttlTimer = this.#createTtlTimer(options);
    const onExitPromise = this.#onExitPromise();
    const cbPromise = this.#execCallback(onLockFn, options);

    // A race between callback processing and the TTL timer.
    try {
      return await Promise.race([cbPromise, ttlTimer.promise, onExitPromise.promise])
        .finally(() => { // In any case, turn off the timer.
          // Avoid if statements as a measure against coverage issue
          ttlTimer.id && clearTimeout(ttlTimer.id);
          onExitPromise.onExitResolve('No forced termination');
          this.#onExitReject = null;
        }
      );
    }
    catch (err) {
      this._onError(err, errMsg, options, 'ECALLBACK');
      throw err;
    }
    finally {
      await release();
    }
  }


  async #execWithLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    return this.#execLockCommon(
      onLockFn, 
      () => this._acquire(options), 
      () => this._release(options), 
      'Callback or Timer in withLock().',
      options
    );
    /*
    // Acquire the lock.
    await this._acquire(options);

    // Created promises.
    const ttlTimer = this.#createTtlTimer(options);
    const onExitPromise = this.#onExitPromise();
    const cbPromise = this.#execCallback(onLockFn, options);

    // A race between callback processing and the TTL timer.
    try {
      return await Promise.race([cbPromise, ttlTimer.promise, onExitPromise.promise])
        .finally(() => { // In any case, turn off the timer.
          // Avoid if statements as a measure against coverage issue
          ttlTimer.id && clearTimeout(ttlTimer.id);
          onExitPromise.onExitResolve('No forced termination');
          this.#onExitReject = null;
        }
      );
    }
    catch (err) {
      this._onError(err, 'Callback or Timer in withLock()', options, 'ECALLBACK');
      throw err;
    }
    finally {
      await this._release(options);
    }
  */
  }

  #onExitPromise() {
    let onExitResolve!: ((v: unknown) => void);
    return {
      promise: new Promise((resolve, reject) => {
        onExitResolve = resolve;
        this.#onExitReject = reject;
      }),
      onExitResolve
    };
  }

  async #execWithoutLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    return this.#execLockCommon(
      onLockFn, 
      () => this._incReantryCount(options), 
      () => this._decReantryCount(options), 
      'Re-entrant locking callback.',
      options
    );
/*
    // Increment lock counter.
    await this._incReantryCount(options);

    // Created promises.
    const ttlTimer = this.#createTtlTimer(options);
    const cbPromise = this.#execCallback(onLockFn, options);
    const onExitPromise = this.#onExitPromise();
    try {

      return await Promise.race([cbPromise, ttlTimer.promise, onExitPromise.promise])
        .finally(() => { // In any case, turn off the timer.
          // Avoid if statements as a measure against coverage issue
          ttlTimer.id && clearTimeout(ttlTimer.id);
          onExitPromise.onExitResolve('No forced termination');
          this.#onExitReject = null;
        }
      );
    }
    catch (err) {
      this._onError(err, 'Re-entrant locking callback.', options, 'ECALLBACK');
      throw err;
    }
    finally {
      // Decrement lock counter.
      await this._decReantryCount(options);
    }
  */
 }

  /**
   * @internal
   * Increment the re-entry lock counter.
   * @param options 
   * @abstract
   */
  protected async _incReantryCount(options: AllOptions<O, I>): Promise<void> {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @internal
   * Decrement the re-entry lock counter.
   * @param options 
   * @abstract
   */
  protected async _decReantryCount(options: AllOptions<O, I>): Promise<void> {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /** 
   * @internal
   * Make preparations for the lock.
   * @param options 
   * @abstract
   */
  protected _prepare(options: AllOptions<O, I>): void {
    this.#newMonitor(options);
  }
  
  /**
   * @internal
   * Handle errors that occur while locked.
   * @param err 
   * @param operation 
   * @param options 
   * @abstract
   */
  protected _onError(err: unknown, operation: string, options: AllOptions<O, I>, codeIfNon: string = 'ELOCK') {
    if (this.#isAlreadyCancelled(options)) return;
    const code: string = (err instanceof Error && 'code' in err && err.code ? String(err.code) : codeIfNon);
    this.#setMonitor({ cancelled: true, reason: code, cause: err, operation}, options)
  }

  /**
   * @internal
   * 
   * @param options 
   * @returns 
   */
  #isAlreadyCancelled(options: AllOptions<O, I>): boolean {
    return options._monitor?.cancelled as boolean;
  }

  /** 
   * @internal
   * Retrieve the current context. <br>
   * It is set to `private` for testing purposes.
   */
  private _getReentrantContext() : ReentrantContext | null {
    return LockBase._als.getStore() ?? null;
  }

  /**
   * @internal
   * Execute callback function in child context (for reentrant lock detection).
   * @param onLockFn  A user-specified function called during the lock.
   * @returns A `Promise` that resolves to the return value of onLockFn.
   */
  #execCallback(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    REQUIRE_DEBUG(options._monitor !== undefined, 'options._monitor is undefined!', LockError, { code: 'EINVAL' });
    const parent = this._getReentrantContext() as any;
    let child: ReentrantContext;
    let monitor: Monitor = options._monitor as Monitor; // 事前条件でチェック済
    const contextId: string = options._contextId;
    if (parent.heldLocks.has(contextId)) {
      // 互いの処理中断情報を共有するため親のmonitorを共有
      options._monitor = monitor = parent.heldLocks.get(contextId).monitor;;
      child = parent;
    }
    else {
      child = { heldLocks: new Map(parent?.heldLocks) };
      child.heldLocks.set(contextId, { monitor });
    }

    return LockBase._als.run(child, async () => onLockFn(monitor));
  }

  /**
   * @internal
   * Check whether re-entrant locking is used.
   */
  #isReentry(options: AllOptions<O, I>): boolean {
    return Boolean(this._getReentrantContext()?.heldLocks.has(options._contextId));
  }

  /**
   * @internal
   * Create a new context and execute the function `fn` within that context.
   * @param {function} fn 
   * @returns 
   */
  #runInNewContext(fn: () => any) {
    const initialContext: ReentrantContext = { heldLocks: new Map() };
    return LockBase._als.run(initialContext, () => {
      return fn();
    });
  }

  /**
   * @internal
   * Create a new monitor.
   * @param options
   * @returns A new monitor.
   */
  #newMonitor(options: AllOptions<O, I>): Monitor {
    //this.#deleteMonitor(options);
    return options._monitor = {cancelled:false, id: Math.random().toString(36).slice(2)};
  }

  /**
   * @internal
   * Delete the monitor.
   * @param options
   */
  /*
  #deleteMonitor(options: AllOptions): void {
    delete options._monitor;
  }
  */

  /**
   * @internal
   * Set the value on the monitor.
   * @param options
   * @returns Monitor reflecting the values.
   */
  #setMonitor(mon: Monitor, options: AllOptions<O, I>): void {
    options._monitor = options._monitor || this.#newMonitor(options);
    Object.assign(options._monitor, mon);
    //const curMon: Monitor = options._monitor ? options._monitor : this.#newMonitor(options);
    //return options._monitor = Object.assign(curMon, mon);
  }
}

export { type Monitor };