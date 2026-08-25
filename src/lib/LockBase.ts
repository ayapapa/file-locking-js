import { AsyncLocalStorage } from 'node:async_hooks';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { LockError, DeadlockDetected } from './LockErrorsBase.ts';
import { type AllOptions } from './AllOptions.ts';
import { type UserOptionsBase } from './UserOptionsBase.ts';
import { type InternalStateBase, type Monitor } from './InternalStateBase.ts'

const {REQUIRE_DEBUG} = Contracts;

/** Definition of the callback function to be executed after acquiring the lock. */
export type CallbackOnLock = (monitor: Monitor) => any;

/** Context object for reentrancy lock detection. */
export interface ReentrantContext  {
  /** Set of reentrant context ids */
  heldLocks: Map<string, { monitor: Monitor }>;
}

/** Type of the log output object. */
export type LogProvider = Pick<Console, 'log' | 'trace' | 'debug' | 'info' | 'warn' | 'error' > & {fatal?: (...args: any[]) => void};

/** Basic config */
export interface BaseConfig {
   /**
    * External logger. 
    * Default is `console`.
    */
   logger?: LogProvider;

   /** 
    * The number of stack frames collected in the stack trace of LockError and 
    * its subclasses (DeadlockDetected, TTLExceeded, AlreadyLocked, LockCompromised, FileLockError, etc.).
    * The default value is 10 but may be set to any valid JavaScript number. 
    * If set to a non-number value, or set to a negative number, stack traces will not capture any frames.
    */
   ErrorStackTraceLimit?: number;
 }

/**
 * Base class for implementing mutual exclusion (locking). 
 * Uses AsyncLocalStorage to prevent re-entrant locking issues. 
 *
 * Note: Preventing re-entrant locking via AsyncLocalStorage is effective
 * only within the same asynchronous context in the same Node process. 
 * It does not extend to controlling re-entrancy across processes launched
 * from within that context.
 * @abstract
 */
export class LockBase <T extends UserOptionsBase = UserOptionsBase, I extends InternalStateBase = InternalStateBase>  {

  /** 
   * Static fieilds. 
   */

  /**
   * AsyncLocalStorage. 
   * Used for reentrant lock detection.
   * Since the goal is to share reentrancy context information (via `getStore()`) regardless of the specific instance, 
   * it is implemented as a static property to enable sharing across instances.  
   */
  private static _als: AsyncLocalStorage<ReentrantContext> = new AsyncLocalStorage<ReentrantContext>();

  /** 
   * Instance fieilds. 
   */

  /** Logger. */
  protected _logger: LogProvider;

  /** Lock key */
  protected _key: string;

  /** Context ID (for reentrant lock detection). */
  //#contextId: string;

  /** Instance methods. */

  /**
   * Constructor.
   * @param key     Lock key.
   * @param config  Configuration.
   */
  protected constructor(key: string, config?: BaseConfig) {
    this._key = key;
    //this.#contextId  = key;// crypto.randomUUID();
    this._logger = config?.logger ?? console;
    if (this._logger === console) {
      this._logger = {...console as LogProvider};
      this._logger.trace = this._logger.debug;
    }
    // There are cases where 'fatal' is not present; in such instances, use 'error'.
    if (!this._logger.fatal) this._logger.fatal = this._logger.error;
  }

  /**
   * Acquires a lock for the specified key,
   * executes the function `onLockFn` under exclusive control, and returns a Promise that resolves with the return value of `onLockFn` after the lock is released.
   *
   * @param onLockFn      A user-specified callback function to be executed after acquiring the lock.
   * @param execWithLock  The callback function that actually executes `withLock`.  
   * @param options       Options.
   * @returns A `Promise` that resolves with the return value of `onLockFn`.
   * @abstract
   */
  protected async _withLock(onLockFn: CallbackOnLock, execWithLock: (cb: () => any, opt: AllOptions<T, I>) => any, options: AllOptions<T, I>) {
    REQUIRE_DEBUG(onLockFn && typeof onLockFn === 'function', 'Invalid onLockFn.', LockError, {code: 'EINVAL'});
    REQUIRE_DEBUG(execWithLock && typeof execWithLock === 'function', 'Invalid execWithLock.', LockError, {code: 'EINVAL'});

    const execDependingOnReentry = () => {
      // Preparing for recursive lock checks.
      const rc = this._getReentrantContext();
      if (!rc) {
        // Since there is no context for reentrancy lock detection yet, I will create a new context and call `withLock` again within it.
        return this.#runInNewContext(() => execDependingOnReentry());
      }

      // Re-entry lock check.
      if (this.#isReentry(options)) {
        // Error if reentrant locks are not permitted.
        if (!options.allowReentry) throw new DeadlockDetected(null, { key: this._key });

        // Since re-entry is permitted, increment the lock count and then execute the callback.
        this._logger.trace("Allow re-entry locks in accordance with `options.allowReentry`.");
        this._incReantryCount(options);
        try {
          return this.#execCallback(onLockFn, options);
        }
        catch (err) {
          this._onError(err, 'Callback in LockBase._withLock()', options);
          throw err;
        }
        finally {
          this._decReantryCount(options);
        }
      }

      // Exeute locking operations.
      return execWithLock(() => this.#execCallback(onLockFn, options), options);
    }
    
    return execDependingOnReentry();
  }

  /**
   * Increment the re-entry lock counter.
   * @param options 
   * @abstract
   */
  protected _incReantryCount(options: AllOptions<T, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOTIMPL', props: options })
  }

  /**
   * Decrement the re-entry lock counter.
   * @param options 
   * @abstract
   */
  protected _decReantryCount(options: AllOptions<T, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOTIMPL', props: options })
  }

  /** 
   * Make preparations for the lock.
   * @param options 
   * @abstract
   */
  protected _prepare(options: AllOptions<T, I>): void {
    this.#newMonitor(options);
  }
  
  /**
   * Handle errors that occur while locked.
   * @param err 
   * @param operation 
   * @param options 
   * @abstract
   */
  protected _onError(err: any, operation: string, options: AllOptions<T, I>) {
    this.#setMonitor({ cancelled: true, reason: err.code ?? 'ELOCK', operation}, options)
  }

  /**
   * Execute callback function in child context (for reentrant lock detection).
   * @param onLockFn  A user-specified function called during the lock.
   * @returns A `Promise` that resolves to the return value of onLockFn.
   */
  #execCallback(onLockFn: CallbackOnLock, options: AllOptions<T, I>) {
    const parent = this._getReentrantContext() as any;
    let child: ReentrantContext;
    let monitor: Monitor;
    const contextId: string = options.contextId;
    if (parent.heldLocks.has(contextId)) {
      monitor = parent.heldLocks.get(contextId).monitor;
      options.monitor = monitor;
      child = parent;
    }
    else {
      child = { heldLocks: new Map(parent?.heldLocks) };
      monitor = options.monitor as any;
      child.heldLocks.set(contextId, { monitor });
    }

    return LockBase._als.run(child, async () => onLockFn(monitor));
  }

  /**
   * Check whether re-entrant locking is used.
   */
  #isReentry(options: AllOptions): boolean {
    return Boolean(this._getReentrantContext()?.heldLocks.has(options.contextId));
  }

  /**
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

  /** Retrieve the current context. */
  _getReentrantContext() : ReentrantContext | null {
    return LockBase._als.getStore() ?? null;
  }

  /**
   * Create a new monitor.
   * @param options
   * @returns A new monitor.
   */
  #newMonitor(options: AllOptions<T, I>): Monitor {
    this.#deleteMonitor(options);
    return this.#setMonitor({cancelled:false, id: Math.random().toString(36).slice(2)}, options);
  }

  /**
   * Delete the monitor.
   * @param options
   */
  #deleteMonitor(options: AllOptions): void {
    delete options.monitor;
  }

  /**
   * Set the value on the monitor.
   * @param options
   * @returns Monitor reflecting the values.
   */
  #setMonitor(mon: Monitor, options: AllOptions<T, I>): Monitor {
    return options.monitor ? Object.assign(options.monitor, mon) : options.monitor = mon;
  }
}

/** Asynchronous sleep. */
export async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Synchronous sleep. */
export function sleepSync(ms: number) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, ms);
}

export { Monitor };