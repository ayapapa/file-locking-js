import { AsyncLocalStorage } from 'node:async_hooks';
import { onExit } from 'signal-exit';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { LockError, DeadlockDetected, TTLExceeded } from './LockBaseErrors.ts';
import { type AllOptions } from './AllOptions.ts';
import { type LockBaseRequiredOptions } from './LockBaseOptions.ts';
import { type LockBaseInternalState } from './LockBaseInternalState.ts'
import { defaultLockBaseConfig, type LockBaseConfig, type LogProvider } from './LockBaseConfig.ts'
import { isEqualObjectType } from './Util.ts';
import { type Monitor } from './LockMonitor.ts';

const { ENSURE_DEBUG, REQUIRE_DEBUG } = Contracts;

/** Definition of the callback function to be executed after acquiring the lock. */
export type CallbackOnLock = (monitor: Monitor) => MaybePromise;

/** Definition of the return type of callback function to be executed after acquiring the lock. */
export type MaybePromise = unknown | PromiseLike<unknown>;

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
   * Current basic configurations.
   */
  protected static _config: Required<LockBaseConfig> = { ...defaultLockBaseConfig };

  /** 
   * @internal
   * Logger.
   */
  protected static _logger =  LockBase._resolveLogger(LockBase._config);
  
  /** 
   * @internal
   * Array of termination handler functions.
   */
  private static _onExitFns = [] as ((code: number | null | undefined, signal: NodeJS.Signals | null) => void)[];

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

  /**
   * @internal
   * Termination processing. 
   * On Windows, this is not called upon forced termination (process.kill()), but the implementation is retained.
   * @param code 
   * @param signal 
   */
  public static onExit(code: number | null | undefined, signal: NodeJS.Signals | null) {
    LockBase._onExitFns.forEach(fn => fn(code, signal));
  }

  /**
   * @internal
   * Register an additional handler for the termination event.
   * @param fn  The termination callback function to register.
   * @returns 
   */
  protected static _addOnExit(fn: (code: number | null | undefined, signal: NodeJS.Signals | null) => void): void {
    if (LockBase._onExitFns.find(f => f === fn)) return;
    LockBase._onExitFns.push(fn);
  }

  /**
   * @internal
   * Copy config. 
   * @param config Configurations.
   */
  protected static _copyConfig<T extends LockBaseConfig>(config: T): T {
    const withourLogger  = { ...config };
    // Since function objects cannot be copied via `structuredClone`, they are excluded for the time being.
    const logger = withourLogger.logger;
    delete withourLogger.logger;
    // Properties with `undefined` values ​​are removed for design reasons.
    for (const key in withourLogger) {
      if (withourLogger[key] === undefined) delete withourLogger[key];
    }
    // Adds `logger` to the copied object and returns it.
    return Object.assign(structuredClone(withourLogger), { logger });
  }

  /**
   * @internal
   * Get a logger where all methods are mandatory.
   * @param config 
   * @returns A logger where all methods are mandatory.
   */
  protected static _resolveLogger(config: Required<LockBaseConfig>): Required<LogProvider> {
    let logger: LogProvider = config.logger;
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
   * @internal
   * Statically holds the specified `config` (type: `LockBaseConfig`).
   * @param config  Configurations. 
   */
  protected static setConfig(config: LockBaseConfig): void {
    LockBase._config = LockBase.#resolveConfig(config);
    LockBase._logger = LockBase._resolveLogger(LockBase._config);

    // Set configurations of `Contrats`.
    Contracts.setConfig({ debug: LockBase._config._debug, logger: LockBase._logger });
  }
  
  /**
   * @interface
   * @param config  User-specified settings.
   * @returns A required object for configuration properties.
   */
  static #resolveConfig(config: LockBaseConfig): Required<LockBaseConfig> {
    REQUIRE_DEBUG(() => isEqualObjectType(LockBase._config, defaultLockBaseConfig),
      'The current configuration is invalid.', LockError, { code: 'EINVAL' });

    const curConf = LockBase._config as Record<string, unknown>;
    const newConf = config as Record<string, unknown>;
    const rConf = { ...curConf } as Record<string, unknown>;
    Object.keys(curConf).forEach(key => {
      if (key in newConf) rConf[key] = newConf[key];
    });
    ENSURE_DEBUG(() => {
      let ret = true;
      const keys = Object.keys(defaultLockBaseConfig);
      for (let i = 0; i < keys.length && (ret = keys[i] in rConf); i++);
      return ret; 
    }, "Some required keys are missing.", LockError, { code: 'EINVAL' });
    // Cast the value, as it has already been verified above.
    return rConf as Required<LockBaseConfig>;
  }

  /** 
   * Instance fieilds. 
   */

  /**
   * @internal
   * Whether or not a lock is acquired.
   */
  protected _acquired: boolean = false;

  /** 
   * @internal
   * Lock key
   */
  protected _debug: boolean= false;

  /** 
   * @internal
   * Lock key
   */
  protected _key: string;

  /**
   * @internal
   *  Logger.
   */
  protected _logger: Required<LogProvider>;

  /**
   * @internal
   * Lock owner ID to be stored in the lock file.
   */
  protected _ownerId: string;

  /**
   * @internal
   * Function to report a forced termination during asynchronous processing.
   */
  #onExitRejects: Record<string, ((reason?: unknown) => void)> = {};

  /**
   * @internal
   * Function to report that an lock compromised error occurred during asynchronous processing.
   */
  #onInterruptRejects: Record<string, ((reason?: unknown) => void)> = {};

  /**
   *  Instance methods. 
   */

  /**
   * @internal
   * Constructor.
   * @param key     Lock key.
   * @param config  Configuration.
   */
  protected constructor(key: string, config: LockBaseConfig = LockBase._config) {
    this._key     = key;
    this._logger  = LockBase._resolveLogger(LockBase.#resolveConfig(config));
    this._ownerId = crypto.randomUUID();
    this._debug   = config._debug === true;
  }

  /**
   * @internal
   * @abstract
   * Acquire the lock.
   * @param options Lock options.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async _acquire(options: AllOptions<O, I>): Promise<void> {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @internal
   * Outputs a debug log.<br>
   * Outputs via `logger.log()` only when `_debug` in the configuration (the `config` constructor argument) is set to `true`.
   * Headers (such as [DEBUG]) are not automatically added.
   * @param args The arguments passed to `logger.log()`.
   */
  protected _debugLog(...args: unknown[]): void {
    this._debug && this._logger.log(...args);
  }

  /**
   * @internal
   * @abstract
   * Decrement the re-entry lock counter.
   * @param options Lock options.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async _decReantryCount(options: AllOptions<O, I>): Promise<void> {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

 /**
   * @internal
   * @abstract
   * Increment the re-entry lock counter.
   * @param options Lock options.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async _incReantryCount(options: AllOptions<O, I>): Promise<void> {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @interna
   * @abstract
   * Create a promise for interrupt detection.<br>
   * This method is intended to be overridden in subclasses as needed.
   * If you override this, you must also override the `_isInterrupt` method to determine 
   * whether the interrupt is the one expected. (See the `_isInterrupt` method.) 
   * @returns A `promise` for detecting interrupt processing, along with its `resolve` and `reject` functions.
   */
  // v8 ignore next 3
  protected _interruptPromise(): { promise: Promise<unknown>, resolve: (v: unknown) => void, reject: (r?: unknown) => void} | undefined {
    return;
  }

  /**
   * @internal
   * @abstract
   * Determines whether an error that has occurred is an expected error (an interruption). 
   * This method is intended to be overridden in conjunction with the `_interruptPromise` method. (See the `_interruptPromise` method.)
   * @param _err Error occurred
   * @returns Returns `true` if it is an expected error, otherwise `false`.
   */
  // v8 ignore next 3
  protected _isInterrupt(_err: unknown): boolean {
    return false;
  }
  
  /**
   * @internal
   * @abstract
   * Handle errors that occur while locked.
   * @param err       Error instance.
   * @param operation Operation description
   * @param options   Lock options.
   * @param codeIfNon Error code.
   */
  protected _onError(err: unknown, operation: string, options: AllOptions<O, I>, codeIfNon: string = 'ELOCK') {
    if (this.#isAlreadyCancelled(options)) return;
    const code: string = (err instanceof Error && 'code' in err && err.code ? String(err.code) : codeIfNon);
    this.#setMonitor({ cancelled: true, reason: code, cause: err, operation}, options)
    if (this._isInterrupt(err) && this.#onInterruptRejects[options._sharerId]) {
      this.#onInterruptRejects[options._sharerId](err);
      delete this.#onInterruptRejects[options._sharerId];
    };
  }

  /**
   * @internal
   * @abstract
   * Execute termination processing.<br>
   * In the Windows version, this is not called upon forced termination (process.kill()), but the implementation is being retained.
   * @param code    Exit code.
   * @param signal  Recieved signal.
   */
  protected _onExit(code: number | null | undefined, signal: NodeJS.Signals | null) {
    // If `onExitReject` (the Promise's reject function) is non-null, 
    // the lock has not been released, so an interruption error is set.
    // Incidentally, I am avoiding the use of `if` statements to ensure adequate test coverage.
    Object.keys(this.#onExitRejects).forEach(key => {
      this.#onExitRejects[key](new LockError("Forced termination.", {
        code: 'ETERM',
        props: { reason: { code, signal } }
      }));
      delete this.#onExitRejects[key];
    });
  }

  /** 
   * @internal
   * @abstract
   * Make preparations for the lock.
   * @param options Lock options.
   */
  protected _prepare(options: AllOptions<O, I>): void {
    this.#newMonitor(options);
    options._sharerId = crypto.randomUUID();
    // Note: This ID is a unique identifier assigned to each lock request.
    // If the lock is successfully acquired via the request (i.e., the key is not currently locked),
    // `_sharerId` is set to match this instance's owner ID (`this._ownerId`) upon acquisition.
  }

  /**
   * @internal
   * @abstract
   * Release the lock.
   * @param options Lock options.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async _release(options: AllOptions<O, I>): Promise<void> {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @internal
   * @abstract
   * Acquires a lock for the specified key,
   * executes the function `onLockFn` under exclusive control, 
   * and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.
   *
   * @param onLockFn  A user-specified callback function to be executed after acquiring the lock.
   * @param options   Lock options.
   * @returns A `Promise` that resolves with the return value of `onLockFn`.
   */
  protected async _withLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>): Promise<unknown> {
    REQUIRE_DEBUG(onLockFn && typeof onLockFn === 'function', 'Invalid onLockFn.', LockError, {code: 'EINVAL'});

    const whithLockInContext = async (): Promise<unknown> => {
      // Preparing for recursive lock checks.
      const rc = this._getReentrantContext();
      if (!rc) {
        // Since there is no context for reentrancy lock detection yet, I will create a new context and call `withLock` again within it.
        return this.#runInNewContext(async () => whithLockInContext());
      }

      // Re-entry lock check.
      if (this.#isReentry(options)) {
        // Error if reentrant locks are not permitted.
        if (!options.allowReentry) throw new DeadlockDetected(null, { key: this._key });

        // Since re-entry is permitted, increment the lock count and then execute the callback.
        this._logger.trace(`Allow re-entry lock(key=${this._key}) ` + "in accordance with `options.allowReentry`.");
        return this.#execWithoutLock(onLockFn, options)
      }

      // Exeute locking operations.
      return this.#execWithLock(onLockFn, options);
    }

    return whithLockInContext();
  }

  /** 
   * @internal
   * Retrieve the current context. <br>
   * It is set to `private` for testing purposes.
   */
  private _getReentrantContext() : ReentrantContext | undefined {
    return LockBase._als.getStore();
  }

  /**
   * @internal
   * Create a timer for TTL.
   * @param options Lock options.
   */
  #createTtlTimer(options: AllOptions<O, I>): { id: NodeJS.Timeout | null, promise: Promise<unknown> } {
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

  /**
   * @internal
   * Execute callback function in child context (for reentrant lock detection).
   * @param onLockFn  A user-specified function called during the lock.
   * @param options   Lock options.
   * @returns A `Promise` that resolves to the return value of onLockFn.
   */
  async #execCallback(onLockFn: CallbackOnLock, options: AllOptions<O, I>): Promise<unknown> {
    REQUIRE_DEBUG(options._monitor !== undefined, 'options._monitor is undefined!', LockError, { code: 'EINVAL' });
    const parent = this._getReentrantContext();
    REQUIRE_DEBUG(parent !== undefined, 're-entrant context is undefined!', LockError, { code: 'EINVAL' });
    let child: ReentrantContext;
    let monitor: Monitor = options._monitor as Monitor; // Type-cast it, as it has already been checked via a precondition.
    const contextId: string = options._contextId;
    if (parent?.heldLocks.has(contextId)) {
      // Share the parent's monitor to share process interruption information between them.
      options._monitor = monitor = parent.heldLocks.get(contextId)!.monitor;
      child = parent;
    }
    else {
      child = { heldLocks: new Map(parent?.heldLocks) };
      child.heldLocks.set(contextId, { monitor });
    }

    // 'async' is intentional to treat synchronous exceptions as Promise rejections. 
    // eslint-disable-next-line @typescript-eslint/require-await
    return LockBase._als.run(child, async () => onLockFn(monitor));
  }

  /**
   * @internal
   * A common method for executing a callback function while holding a lock.
   * @param onLockFn  Callback function to execute while locked.
   * @param aquire    Lock acquisition function
   * @param release   Lock release function
   * @param operation Operation description.
   * @param options   Lock options.
   */
  async #execLockCommon(onLockFn: CallbackOnLock, aquire: () => Promise<void>, 
    release: () => Promise<void>, operation: string, options: AllOptions<O, I>): Promise<unknown> {
    // Acquire the lock.
    await aquire();

    // Created promises.
    const ttlTimer      = this.#createTtlTimer(options);
    const onExitPromise = this.#onExitPromise();
    const cbPromise     = this.#execCallback(onLockFn, options);
    const racePrs = [cbPromise, ttlTimer.promise, onExitPromise.promise];
    // Register reject functions.
    this.#onExitRejects[options._sharerId] = onExitPromise.reject;

    // If there is an interrupt promise in the inheriting class, 
    // have it participate in the promise race described below.
    const interruptPromise = this._interruptPromise();
    if (interruptPromise) {
      racePrs.push(interruptPromise.promise);
      this.#onInterruptRejects[options._sharerId] = interruptPromise.reject;
    }

    // A race between callback processing and the TTL timer.
    try {
      return await Promise.race(racePrs)
        .finally(() => { // In any case, turn off the timer.
          // Avoid if statements as a measure against coverage issue
          ttlTimer.id && clearTimeout(ttlTimer.id);
          onExitPromise.resolve('No forced termination');
          delete this.#onExitRejects[options._sharerId];
          if (interruptPromise) {
            interruptPromise.resolve('Ok');
            delete this.#onInterruptRejects[options._sharerId];
          }
        }
      );
    }
    catch (err) {
      this._onError(err, operation, options, 'ECALLBACK');
      throw err;
    }
    finally {
      await release();
    }
  }

  /**
   * @internal
   * Acquire the lock and execute the callback function.
   * @param onLockFn  Callback function to execute while locked.
   * @param options   Lock options.
   * @returns 
   */
  async #execWithLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>): Promise<unknown> {
    return this.#execLockCommon(
      onLockFn, 
      async () => this._acquire(options), 
      async () => this._release(options), 
      'Callback or Timer in withLock().',
      options
    );
  }

  /**
   * @internal
   * Increment the lock counter and execute the callback function.
   * @param onLockFn  Callback function to execute while locked.
   * @param options   Lock options.
   */
  async #execWithoutLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    return this.#execLockCommon(
      onLockFn, 
      async () => this._incReantryCount(options), 
      async () => this._decReantryCount(options), 
      'Re-entrant locking callback.',
      options
    );
  }

   /**
   * @internal
   * Check whether it has been cancelled.
   * @param options Lock options.
   * @returns 
   */
  #isAlreadyCancelled(options: AllOptions<O, I>): boolean {
    return options._monitor?.cancelled as boolean;
  }

  /**
   * @internal
   * Check whether re-entrant locking is used.
   * @param options   Lock options.
   */
  #isReentry(options: AllOptions<O, I>): boolean {
    return Boolean(this._getReentrantContext()?.heldLocks.has(options._contextId));
  }

  /**
   * @internal
   * Create a new monitor and set it in `options`.
   * @param options   Lock options.
   * @returns Created new monitor.
   */
  #newMonitor(options: AllOptions<O, I>): Monitor {
    return options._monitor = {
      cancelled:false, 
      id: Math.random().toString(36).slice(2)
    };
  }

  /**
   * @internal
   * Create a promise for the termination process, set the `reject` function to `this`, 
   * and return the promise and the `resolve` function.
   */
  #onExitPromise() {
    let onExitResolve!: ((v: unknown) => void);
    let onExitReject!: ((r: unknown) => void);
    return {
      promise: new Promise((resolve, reject) => {
        onExitResolve = resolve;
        onExitReject = reject;
      }),
      resolve: onExitResolve,
      reject: onExitReject
    };
  }

  /**
   * @internal
   * Create a new context and execute the function `fn` within the context.
   * @param {function} fn Callback function to be called within the context.
   * @returns 
   */
  #runInNewContext(fn: () => unknown) {
    const initialContext: ReentrantContext = { heldLocks: new Map() };
    return LockBase._als.run(initialContext, () => fn());
  }

  /**
   * @internal
   * Set the value on the monitor.
   * @param monitor Lock monitor.
   * @param options Lock options.
   * @returns Monitor reflecting the values.
   */
  #setMonitor(mon: Monitor, options: AllOptions<O, I>): void {
    options._monitor = options._monitor || this.#newMonitor(options);
    Object.assign(options._monitor, mon);
  }

}

/**
 * Register termination processing (for both normal termination and forced termination via `kill()` or similar).
 * In the Windows version, this is not called upon forced termination (process.kill()), but the implementation is being retained.
 */
onExit(LockBase.onExit);
