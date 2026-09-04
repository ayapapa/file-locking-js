import { AsyncLocalStorage } from 'node:async_hooks';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { LockError, DeadlockDetected } from './LockBaseErrors.ts';
import { type AllOptions } from './AllOptions.ts';
import { type LockBaseUserOptions } from './LockBaseUserOptions.ts';
import { type LockBaseInternalState, type Monitor } from './LockBaseInternalState.ts'
import { type BaseConfig, type LogProvider } from './LockBaseConfig.ts'

const {REQUIRE_DEBUG} = Contracts;

/** Definition of the callback function to be executed after acquiring the lock. */
export type CallbackOnLock = (monitor: Monitor) => any;

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
export class LockBase <T extends LockBaseUserOptions = LockBaseUserOptions, I extends LockBaseInternalState = LockBaseInternalState>  {

  /** 
   * Static fieilds. 
   */

  /**
   * @internal
   * 
   */
  protected static readonly _defaultAllowReentry = false;

  /**
   * @internal
   * 
   */
  protected static readonly _defaultTimeoutMs = 5000;

  /**
   * @internal
   * 
   */
  protected static readonly _defaultTtlMs = 10000;
  
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
   * Get basic default options. 
   */
  public static getDefaultOptions(): LockBaseUserOptions {
    return {
      timeoutMs:      LockBase._defaultTimeoutMs,    // Default maximum wait time for lock release is 5 seconds
      ttlMs:          LockBase._defaultTtlMs,        // Default lock validity period (time to live) is 10 seconds
      allowReentry:   LockBase._defaultAllowReentry, // Default to disallowing re-entrant locks
    };
  }

  /** 
   * Instance fieilds. 
   */

  /**
   * @internal
   *  Logger.
   */
  protected _logger: LogProvider;

  /** 
   * @internal
   * Lock key
   */
  protected _key: string;

  /** Context ID (for reentrant lock detection). */
  //#contextId: string;

  /** Instance methods. */

  /**
   * @internal
   * Constructor.
   * @param key     Lock key.
   * @param config  Configuration.
   */
  protected constructor(key: string, config?: BaseConfig) {
    this._key = key;
    this._logger = config?.logger ?? console;
    if (this._logger === console) {
      this._logger = {...console as LogProvider};
      this._logger.trace = this._logger.debug;
    }
    // There are cases where 'fatal' is not present; in such instances, use 'error'.
    if (!this._logger.fatal) this._logger.fatal = this._logger.error;
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
  protected async _withLock(onLockFn: CallbackOnLock, execWithLock: (cb: () => any, opt: AllOptions<T, I>) => any, options: AllOptions<T, I>) {
    REQUIRE_DEBUG(onLockFn && typeof onLockFn === 'function', 'Invalid onLockFn.', LockError, {code: 'EINVAL'});
    REQUIRE_DEBUG(execWithLock && typeof execWithLock === 'function', 'Invalid execWithLock.', LockError, {code: 'EINVAL'});

    const execDependingOnReentry = async () => {
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
          return await this.#execCallback(onLockFn, options);
        }
        catch (err) {
          this._onError(err, 'Re-entrant locking callback.', options, 'ECALLBACK');
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
   * @internal
   * Increment the re-entry lock counter.
   * @param options 
   * @abstract
   */
  protected _incReantryCount(options: AllOptions<T, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /**
   * @internal
   * Decrement the re-entry lock counter.
   * @param options 
   * @abstract
   */
  protected _decReantryCount(options: AllOptions<T, I>) {
    throw new LockError(`Implement this in the subclass.`, { code: 'ENOIMPL', props: { options } });
  }

  /** 
   * @internal
   * Make preparations for the lock.
   * @param options 
   * @abstract
   */
  protected _prepare(options: AllOptions<T, I>): void {
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
  protected _onError(err: unknown, operation: string, options: AllOptions<T, I>, codeIfNon: string = 'ELOCK') {
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
  #isAlreadyCancelled(options: AllOptions<T, I>): boolean {
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
  #execCallback(onLockFn: CallbackOnLock, options: AllOptions<T, I>) {
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
  #isReentry(options: AllOptions): boolean {
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
  #newMonitor(options: AllOptions<T, I>): Monitor {
    this.#deleteMonitor(options);
    return options._monitor = {cancelled:false, id: Math.random().toString(36).slice(2)};
  }

  /**
   * @internal
   * Delete the monitor.
   * @param options
   */
  #deleteMonitor(options: AllOptions): void {
    delete options._monitor;
  }

  /**
   * @internal
   * Set the value on the monitor.
   * @param options
   * @returns Monitor reflecting the values.
   */
  #setMonitor(mon: Monitor, options: AllOptions<T, I>): void {
    options._monitor = options._monitor || this.#newMonitor(options);
    Object.assign(options._monitor, mon);
    //const curMon: Monitor = options._monitor ? options._monitor : this.#newMonitor(options);
    //return options._monitor = Object.assign(curMon, mon);
  }
}

/** 
 * @internal
 * Asynchronous sleep. 
 */
export async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @internal
 * Synchronous sleep. 
 */
export function sleepSync(ms: number) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, ms);
}

/**
 * @internal
 * Get callstack. 
 */
export function getCallStack(): string {
  const obj: { stack?: string } = {};
  Error.captureStackTrace(obj, getCallStack);
  obj.stack = obj.stack ? obj.stack.replace(/^Error\b/, "Call stack") : `Call stack: couldn't get.`;
  return obj.stack;
} 

export { Monitor };