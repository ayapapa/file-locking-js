import { AsyncLocalStorage } from 'node:async_hooks';
import { onExit } from 'signal-exit';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { LockError, DeadlockDetected, TTLExceeded } from './LockBaseErrors.ts';
import { type AllOptions } from './AllOptions.ts';
import { type LockBaseRequiredOptions } from './LockBaseOptions.ts';
import { type LockBaseInternalState } from './LockBaseInternalState.ts'
import { defaultLockBaseConfig, type LockBaseConfig, type LogProvider } from './LockBaseConfig.ts'
import { isEqualObjectType } from './Util.ts';
import { LockCompromised } from './FileLockErrors.ts';
import { type Monitor } from './LockMonitor.ts';

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
   * @param config  Configurations. 
   */
  protected static setConfig(config: LockBaseConfig): void {
    REQUIRE_DEBUG(isEqualObjectType(LockBase._config, defaultLockBaseConfig),
      'The current configuration is invalid.', LockError, { code: 'EINVAL' });

    // Since the type has been verified, perform a type cast.
    const curConf = LockBase._config as Record<string, unknown>;
    const newConf = config as Record<string, unknown>;
    Object.keys(curConf).forEach(key => {
      if (key in newConf) curConf[key] = newConf[key];
    });

    // logger
    LockBase._logger = LockBase._resolveLogger(LockBase._config);

    // debug
    Contracts.setConfig({ debug: LockBase._config._debug, logger: LockBase._logger });
  }
  
  /**
   * @internal
   * Copy config. 
   * @param config Configurations.
   */
  protected static _copyConfig<T extends LockBaseConfig>(config: T): T {
    const withourLogger  = { ...config };
    // Since function objects cannot be copied, they are excluded for the time being.
    const logger = withourLogger.logger;
    delete withourLogger.logger;
    // Properties with `undefined` values ​​are removed for design reasons.
    for (const key in withourLogger) {
      if (withourLogger[key] === undefined) delete withourLogger[key];
    }
    return Object.assign(structuredClone(withourLogger), { logger });
  }

  /**
   * @internal
   * @param fn  The termination callback function to register.
   * @returns 
   */
  protected static _addOnExit(fn: (code: number | null | undefined, signal: NodeJS.Signals | null) => void): void {
    if (LockBase._onExitFns.find(f => f === fn)) return;
    LockBase._onExitFns.push(fn);
  }

  /**
   * @internal
   * Get a logger where all methods are mandatory.
   * @param config 
   * @returns A logger where all methods are mandatory.
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
   * Whether or not a lock is acquired.
   */
  protected _acquired: boolean = false;

  /**
   * @internal
   * Lock owner ID to be stored in the lock file.
   */
  protected _ownerId: string;

  /**
   * @internal
   * Function to report a forced termination during asynchronous processing.
   */
  #onExitReject: ((reason?: unknown) => void) | null = null;

  /**
   * @internal
   * Function to report that an erosion error occurred during asynchronous processing.
   */
  #onCompromisedReject: ((reason?: unknown) => void) | null = null;

  /**
   *  Instance methods. 
   */

  /**
   * @internal
   * Constructor.
   * @param key     Lock key.
   * @param config  Configuration.
   */
  protected constructor(key: string, config?: LockBaseConfig) {
    this._key = key;
    this._logger = LockBase._resolveLogger(config);
    this._ownerId = crypto.randomUUID();
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

  /**
   * @internal
   * Acquire the lock.
   * @param options 
   */
  protected async _acquire(options: AllOptions<O, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @internal
   * Release the lock.
   * @param options 
   */
  protected async _release(options: AllOptions<O, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @internal
   * Execute termination processing.<br>
   * In the Windows version, this is not called upon forced termination (process.kill()), but the implementation is being retained.
   */
  protected _onExit(code: number | null | undefined, signal: NodeJS.Signals | null) {
    this.#onExitReject && 
      this.#onExitReject(new LockError("Forced termination.", {
        code: 'ETERM',
        props: { reason: { code, signal } }
      }));
  }

  /**
   * 
   * @param options 
   * @returns 
   */
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

  /**
   * @internal
   * @param onLockFn 
   * @param aquire 
   * @param release 
   * @param errMsg 
   * @param options 
   * @returns 
   */
  async #execLockCommon(onLockFn: CallbackOnLock, aquire: () => Promise<void>, 
    release: () => Promise<void>, errMsg: string, options: AllOptions<O, I>) {
    // Acquire the lock.
    await aquire();

    // Created promises.
    const ttlTimer = this.#createTtlTimer(options);
    const onExitPromise = this.#onExitPromise();
    const onCompromised = this.#onCompromised();
    const cbPromise = this.#execCallback(onLockFn, options);

    // A race between callback processing and the TTL timer.
    try {
      return await Promise.race([cbPromise, ttlTimer.promise, onExitPromise.promise, onCompromised.promise])
        .finally(() => { // In any case, turn off the timer.
          // Avoid if statements as a measure against coverage issue
          ttlTimer.id && clearTimeout(ttlTimer.id);
          onExitPromise.onExitResolve('No forced termination');
          this.#onExitReject = null;
          onCompromised.onCompromisedResolve('No compromised');
          this.#onCompromisedReject = null;
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

  /**
   * @internal
   * @param onLockFn 
   * @param options 
   * @returns 
   */
  async #execWithLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    return this.#execLockCommon(
      onLockFn, 
      () => this._acquire(options), 
      () => this._release(options), 
      'Callback or Timer in withLock().',
      options
    );
  }

  /**
   * @internal
   * @param onLockFn 
   * @param options 
   */
  async #execWithoutLock(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
    return this.#execLockCommon(
      onLockFn, 
      () => this._incReantryCount(options), 
      () => this._decReantryCount(options), 
      'Re-entrant locking callback.',
      options
    );
  }

  /**
   * @internal
   */
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

  /**
   * @internal
   */
  #onCompromised() {
    let onCompromisedResolve!: ((v: unknown) => void);
    return {
      promise: new Promise((resolve, reject) => {
        onCompromisedResolve = resolve;
        this.#onCompromisedReject = reject;
      }),
      onCompromisedResolve
    };
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
    options._sharerId = crypto.randomUUID();
    // Note: If this lock request succeeds in acquiring the lock (i.e., if the key is currently unlocked), 
    // `_sharerId` will be overwritten with this instance's owner ID(`this._ownerId`) upon acquisition.
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
    if (err instanceof LockCompromised && this.#onCompromisedReject) {
      this.#onCompromisedReject(err);
    };
  }

  /**
   * @internal
   * Check whether it has been cancelled.
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
  private _getReentrantContext() : ReentrantContext | undefined {
    return LockBase._als.getStore();
  }

  /**
   * @internal
   * Execute callback function in child context (for reentrant lock detection).
   * @param onLockFn  A user-specified function called during the lock.
   * @param options
   * @returns A `Promise` that resolves to the return value of onLockFn.
   */
  #execCallback(onLockFn: CallbackOnLock, options: AllOptions<O, I>) {
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
    return LockBase._als.run(initialContext, () => fn());
  }

  /**
   * @internal
   * Create a new monitor.
   * @param options
   * @returns A new monitor.
   */
  #newMonitor(options: AllOptions<O, I>): Monitor {
    return options._monitor = {
      cancelled:false, 
      id: Math.random().toString(36).slice(2)
    };
  }

  /**
   * @internal
   * Set the value on the monitor.
   * @param monitor 
   * @param options
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

export { type Monitor };