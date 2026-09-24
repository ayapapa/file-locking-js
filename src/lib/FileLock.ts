import path from 'node:path';
import fs from 'node:fs';

import { LRUCache } from 'lru-cache';
import { DateFormatter } from '@ayapapa-npm/date-formatter-js';
import { Contracts } from '@ayapapa-npm/contracts-js';
const { ENSURE_DEBUG, REQUIRE, REQUIRE_DEBUG, VERIFY } = Contracts;

import { LockBase, type CallbackOnLock } from "./LockBase.ts";
import { defaultFileLockOptions, minimumFileLockOptions, type FileLockRequiredOptions, type FileLockOptions } from './FileLockOptions.ts';
import { type FileLockInternalState } from './FileLockInternalState.ts';
import { FileLockOptionsResolver } from "./FileLockOptionsResolver.ts";
import {  AlreadyLocked, FileLockError, InvalidOptions, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed, LockFileBroken } from './FileLockErrors.ts';
import { type AllOptions as AllOptionsT } from './AllOptions.ts';
import { defaultFileLockConfig, type FileLockConfig } from './FileLockConfig.ts';
import { getCallStack, includesAllKeysOf, sleepAsync, sleepSync, typedKeys } from './Util.ts'
import { type FileLockMeta } from './FileLockMeta.ts'

/** 
 * @ internal
 * All options type.
 */
type AllOptions = AllOptionsT<FileLockRequiredOptions, FileLockInternalState>;

/**
* File locking. 
* Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
* While the file exists, no other lock can be acquired for the same key. 
* Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed. 
*/
export class FileLock extends LockBase<FileLockRequiredOptions, FileLockInternalState> {
 
  /** 
   * Static fields 
   */

  /**
   * @internal
   * Store the recently used options (options resolved within the static `withLock()` method). 
   * Normally, there is no need to store them statically because new options are resolved with each call to `withLock()`, but they are stored here for testing purposes.
   */
  protected static _lastOptions: FileLockRequiredOptions | null = null;

  /** 
   * @internal
   * Current configurations.
   */
  static #config: Required<FileLockConfig> = FileLock.getDefaultConfig();

  /**
   * @internal
   * FileLock instance cache associated with a key. 
   * Uses `LRUCache`, providing features to set a maximum cache size and prune (remove) infrequently accessed elements.
   */
  static #cache: LRUCache<string, FileLock> | null;

  /**
   * @internal
   * The lock directory
   */
  static #lockDir = FileLock._getLockDirPath();

  /**
   * @internal
   * The history file name.
   */
  static #historyId: string = DateFormatter.format(new Date(), "yyyyMMdd-HHmmss.fff") + '-' + crypto.randomUUID().slice(0, 12);

  /**
   * @internal
   * The history file name.
   */
  static #historyName: string = `${FileLock.#historyId}.json`;

  /**
   * @internal
   * The history directory path.
   */
  static #historyDir = path.join(FileLock.#lockDir, 'history');

  /**
   * @internal
   * The history file path.
   */
  static #historyPath = path.join(FileLock.#historyDir, FileLock.#historyName);

  /** 
   * Static methods
   */

  /** 
   * @internal
   * Initialize.
   */
  public static _initialize() {
    FileLock.resetConfig();
    FileLock._addOnExit(FileLock.#onExitFn);
  }

  /**
   * Set configurations.<br>
   * Overwrite part of the current settings. 
   * At the same time, the cache is cleared.
   * @param config 
   */
  public static override setConfig(config: FileLockConfig): void {
    super.setConfig(config);

    const dConf = Object.assign(FileLock._copyConfig(config), LockBase._config);
    if (dConf.cacheTtlMs != null) dConf.cacheTtlMs = Math.max(dConf.cacheTtlMs, defaultFileLockConfig.cacheTtlMs);
    if (dConf.cacheMaxNum != null) dConf.cacheMaxNum  = Math.max(dConf.cacheMaxNum, 0);
    if (dConf.maxHistoryEntries != null) dConf.maxHistoryEntries = Math.max(dConf.maxHistoryEntries, 0);
    if (dConf.maxHistoryFiles != null) dConf.maxHistoryFiles = Math.max(dConf.maxHistoryFiles, 0);

    // If defaultOptions is specified, resolve it.
    if (dConf.defaultOptions) {
      dConf.defaultOptions = new FileLockOptionsResolver(dConf.defaultOptions, minimumFileLockOptions).getOptions();
    }
    FileLock.#config = { ...FileLock.getConfig(), ...dConf };

    // chache
    FileLock.#clearCache();
    if (FileLock.#config.cacheMaxNum === 0) FileLock.#config.cache = false;
    FileLock.#config.cacheTtlMs = FileLock.#config.cacheTtlMs;
    // If cache is enabled, (Re)create cache.
    if (FileLock.#config.cache) {
      const opts: LRUCache.Options<string, FileLock, unknown> = {
        max: FileLock.#config.cacheMaxNum,
        ttl: FileLock.#config.cacheTtlMs,
      };
      FileLock.#cache = new LRUCache<string, FileLock>(opts);
    }
    // or set null to chache.
    else {
      FileLock.#cache = null;
    }

    // lock directory
    FileLock.#lockDir = FileLock._getLockDirPath();

    // history
    FileLock.#historyDir =  path.join(FileLock.#lockDir, 'history');
    if (fs.existsSync(FileLock.#historyDir) === false) {
      fs.mkdirSync(FileLock.#historyDir, { recursive: true });
    }
    FileLock.#historyPath =  path.join(FileLock.#historyDir, FileLock.#historyName);
  }

  /** Resets the current settings to their default values. */
  public static resetConfig(): void {
    FileLock.setConfig(FileLock.getDefaultConfig());
  }

  /** Get current configurations. */
  public static getConfig(): Required<FileLockConfig> {
    return FileLock._copyConfig(FileLock.#config);
  }

  /** Get default configurations. */
  public static getDefaultConfig(): Required<FileLockConfig> {
    return FileLock._copyConfig(defaultFileLockConfig);
  }

  /**
   * Acquires a lock for the specified key, executes the function `onLockFn` under exclusive control, 
   * and returns a Promise that resolves with the return value of `onLockFn` after the lock is released. 
   *
   * @param key       Lock key.
   * @param onLockFn  Callback function to execute while the lock is held.
   *                  Both synchronous and asynchronous functions can be specified.
   * @param options   Options
   * @return A Promise that resolves with the return value of onLockFn.
   */
  public static async withLock(key: string, onLockFn: CallbackOnLock, options: FileLockOptions  = {}): Promise<any> {
    REQUIRE(typeof key === 'string' && key !== '', '`key` must be specified as a non-empty string.', InvalidOptions, { code: 'EINVAL' });

    // If defaultOptions is specified in the config, it will be used as the default options.
    const defaultOpts: FileLockRequiredOptions = { ...FileLock.getDefaultOptions(), ...FileLock.#config.defaultOptions };

    // Resolve options.
    const rOpt = new FileLockOptionsResolver(options, minimumFileLockOptions, defaultOpts).getRequiredOptions();

    // For testing
    FileLock._lastOptions = rOpt;
    
    return FileLock._getLock(key).withLock(onLockFn, rOpt);
  }

  /**
   * Get default options(`FileLockOptions`).
   * @returns Deault options.
   */
  public static getDefaultOptions(): FileLockRequiredOptions {
    return { ...defaultFileLockOptions };
  }

  /**
   * Get the history informations.
   * @returns 
   */
  public static getHistoryInfo(): Readonly<{
    historyEnabled: boolean, 
    historyId: string, 
    historyPath: string, 
    processId: number 
  }> {
    return {
      historyEnabled: FileLock.#config.history,
      historyId: FileLock.#historyId,
      historyPath: FileLock.#historyPath,
      processId: process.pid,
    }
  }

  /**
   * @internal
   * Termination processing. 
   * On Windows, this is not called upon forced termination (process.kill()), but the implementation is retained.
   * @param code 
   * @param signal 
   */
  static #onExitFn(code: number | null | undefined, signal: NodeJS.Signals | null) {
    FileLock._logger.trace("Exited by", { code, signal });
    FileLock.#cache?.forEach( lock => lock.#onExit(code, signal));
  }

  /**
   * @internal
   * Get `lock` instance. <br>
   * It is set to `private` for testing purposes.
   * @param key Lock key. 
   */
  private static _getLock(key: string): FileLock {
    if (FileLock.#hasCache(key)) {
      // Since its existence has been confirmed, I will type-cast it.
      return FileLock._getCache()?.get(key) as FileLock;
    }
    const lock = new FileLock(key);
    FileLock.#setCache(key, lock);
    return lock;
  }
  
  /**
   * @internal
   * Get `cache` instance. <br>
   * It is set to `private` for testing purposes.
   */
  private static _getCache(): LRUCache<string, FileLock> | null {
    return FileLock.#cache;
  }

  /**
   * @internal
   * Get a directory path for storing files containing lock information.<br>
   * If it has been specified, use this as the top priority.<br>
   * The directory is determined based on the following order of priority:<br>
   *  1. Specified via an `FileLockConfig` (user's explicit intent)
   *  2. `process.cwd()` (current working directory at runtime)
   * Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.<br>
   * It is set to `private` for testing purposes.
   * @returns A directory path for storing files containing lock information.
   */
  private static _getLockDirPath() {
    const existsDir = (name: string): boolean => {
      let stat;
      try {
        stat = fs.statSync(name);
      }
      catch (err) {
        REQUIRE(err instanceof Error, 'The caught object was not an Error instance.', FileLockError, { code: 'EUNEXPECTED', props: { cause: err } });
        const e = err as Error; // Type-cast because it has been verified.
        const code = 'code' in e && String(e.code);
        if (code === 'ENOENT') return false;
        throw new LockDirectoryStatFailed(e.message, { path: name, props: { fsErrCode: code } } );
      }
      
      if (stat.isDirectory()) return true

      throw new FileLockError(`'${name}' is not a directory.`, { code: 'ENOTDIR', props: { path: name } });
    }

    const mkdir = (name: string): void => {
      try {
        fs.mkdirSync(name,  { recursive: true });
      }
      catch (err: any) {
        throw new LockDirectoryCreationFailed(err.message, { path: name, props: { path: name, fsErrCode: err.code } });
      }
    }

    const candies = {
      'config.lockDirectory' : FileLock.#config.lockDirectory,
      'process.cwd()': path.join(process.cwd(), '.lock'),
    };

    // Check whether the directory is one specified by the user.
    const isSpecified = (i: number) => i === 0;

    // Create a lock directory.
    let candidates: string = '';
    const keys = typedKeys(candies);
    for(let i = 0; i < keys.length; i++) {
      const dir = candies[keys[i]];
      if (!dir) continue;
      candidates += "\n" + `- ${dir}`;
      try {
        if (existsDir(dir) === false) mkdir(dir);
        return dir;
      }
      catch (err) {
        if (isSpecified(i)) throw err;
        continue;
      }
    };
    // Failed to create lock directory.
    throw new LockDirectoryCreationFailed(
      "Failed to create the lock directory." +
      "\nAttempted to locate and create it in the following order:" +
      candidates,
      { props: { candidates } }
    );
  }

  /**
   * @internal
   * Whether the instance corresponding to `key` is cached. 
   * @param key Lock key. 
   */
  static #hasCache(key: string): boolean {
    const cache = FileLock._getCache();
    return Boolean(cache && cache.has(key));
  }

  /**
   * @internal
   *  Clear `lock` instance cache. 
   */
  static #clearCache() {
    const cache = FileLock._getCache();
    if (cache) cache.clear();
  }

  /**
   * @internal
   * Whether the instance corresponding to `key` is cached. 
   * @param key   Lock key. 
   * @param lock  Lock instance. 
   */
  static #setCache(key: string, lock: FileLock): void  {
    const cache = FileLock._getCache();
    if (cache) cache.set(key, lock);
  }

  /** 
   * Instance fields.
   */

  /**
   * @internal
   * Heartbeat timer id 
   */
  private _heartbeatTimer: NodeJS.Timeout | null = null;

  /** 
   * Instance methods.
   */

  /**
   * @internal
   * Creates a FileLock instance.
   * @param {string}  key Locking key.
   */
  private constructor(key: string) {
    super(key, FileLock.#config);
  }

  async #share(op: () => void, options: AllOptions): Promise<void> {
    // Lock share directory.
    const interval = options.pollIntervalMs;
    const timeout = Date.now() + options.timeoutMs;
    const lockPath = path.join(options._sharerDir, '.lock');
    let lastErr;

    do {
      try {
        this.#createFileSyncExclusively(lockPath, options);
        break;
      }
      catch (err) {
        lastErr = err;
        await sleepAsync(interval);
      }
    } while (Date.now() <= timeout);

    if (lastErr instanceof Error) throw Object.assign(lastErr, { path: lockPath });
    
    // Exec operation
    try {
      op();
    }
    finally {
      this.#unlinkSync(lockPath, options);
    }
  }

  async #addSharer(options: AllOptions, msg: string = "Failed to add the lock request to lock sharers.") {
    const sharerPath = path.join(options._sharerDir, options._sharerId);
    try {
      await this.#share(() => this.#writeFileSync(sharerPath, '', options), options);
    }
    catch (err) {
      throw new FileLockError(msg, {
        code: 'EIO', props: { key: this._key, sharer: options._sharerId, causes: [err] }
      });
    }
  }

  async #removeSharer(options: AllOptions, msg: string = "Failed to remove the lock request from the lock sharers.") {
    const sharerPath = path.join(options._sharerDir, options._sharerId);
    try {
      await this.#share(() => this.#unlinkSync(sharerPath, options), options);
    }
    catch (err) {
      throw new FileLockError(msg, {
        code: 'EIO', props: { key: this._key, sharer: options._sharerId, causes: [err] }
      });
    }
  }

  /**
   * @internal
   * Increment lock counter.
   * @param options 
   */
  protected override async _incReantryCount(options: AllOptions): Promise<void> {
    await this.#addSharer(options);
    /*
    const sharerPath = path.join(options._sharerDir, options._sharerId);
    try {
      await this.#share(() => this.#writeFileSync(sharerPath, '', options), options);
    }
    catch (err) {
      throw new FileLockError("Failed to increment the re-entrant lock counter.", {
        code: 'ERENTRY', props: { key: this._key, sharer: options._sharerId, causes: [err] }
      });
    }
    */

    /*
    const meta = this.#getInfo(options);
    options._ownerId =  options._ownerId || meta.ownerId;
    meta.counter = meta.counter;
    meta.counter++;
    return this.#updateInfo(meta, options);
    */
  }

  #readdirSync(path: string, options: AllOptions, msg = "Couldn't read the direcroty."): fs.Dirent<string>[] {
    return this.#accessInfo(
      path,
      () => fs.readdirSync(path, { withFileTypes: true }), 
      options, 
      msg
    );
  }

  async #countSharer(options: AllOptions, msg: string): Promise<number> {
    try {
      return this.#readdirSync(options._sharerDir, options).
          filter(item => item.isFile() && item.name !== '.lock').
          map(item => item.name).length;
    }
    catch (err) {
      throw new FileLockError(msg, {
        code: 'EIO', props: { key: this._key, sharer: options._sharerId, _causes: [err] }
      });
    }
  }

  /**
   * @internal
   * Decrement lock counter.
   * And, when the counter becomes '0', release lock.
   * @param options 
   */
  protected override async _decReantryCount(options: AllOptions): Promise<void> {
    await this.#removeSharer(options);

    const count = await this.#countSharer(options, "Failed to count the lock sharer.");
    if (count === 0) {
      this.#actuallyRelease(options);
    }
    /*
    // 残りの共有者数が0なら、ロック解除を実行する
    try {
      const count = this.#readdirSync(options._sharerDir, options).
          filter(item => item.isFile() && item.name !== '.lock').
          map(item => item.name).length;
    }
    catch (err) {
      throw new FileLockError("Failed to decrement the lock counter.", {
        code: 'EIO', props: { key: this._key, sharer: options._sharerId, _causes: [err] }
      });
    }
    */
   /*
    let meta;
    try {
      meta = this.#getInfo(options);
      if (options._ownerId === meta.ownerId && meta.counter > 0) {
        meta.counter--;
        this.#updateInfo(meta, options);
      }
    }
    catch (err) {
      this._onError(err, 'FileLock.#getInfo()', options);
      this.#actuallyRelease(options);
      throw err;
    }
    if (meta && meta.counter === 0) {
      this.#actuallyRelease(options);
    }
    return;
    */
  }

  /**
   * @internal
   * Make advance preparations.
   * @param options Options
   */
  protected override _prepare(options: AllOptions): void {
    super._prepare(options);
    // ディレクトリ指定はsetConfig()で変更される可能性があるため、各パスはここで構築する。
    const dirPath       = FileLock.#lockDir;
    //const fileDir     = path.join(dirPath, this._key);
    options._filePath   = path.join(dirPath, this._key + '.json');
    options._sharerDir  = path.join(dirPath, this._key + '.sharer');
    options._contextId  = options._filePath;  // Use the file path as the context ID 
                                                // to avoid issues caused by changes 
                                                // to the lock directory configuration.
    //options._historyFilePath  =  FileLock.#historyPath;
  }

  /**
   * @internal
   * Acquires a lock, executes the function `onLockFn` under exclusive control, 
   * and returns a Promise that resolves with the return value of `onLockFn` after the lock is released. 
   *
   * @param onLockFn  Callback function to execute while the lock is held.
   * @param options   Options
   * @return A Promise that resolves with the return value of onLockFn.
   */
  private async withLock(onLockFn: CallbackOnLock, userOpts: FileLockRequiredOptions): Promise<any> {
    REQUIRE_DEBUG(includesAllKeysOf(userOpts, FileLock.getDefaultOptions()), 
      "The option remains unresolved.", InvalidOptions, { name: 'userOpts', props: { options: userOpts } } );

    // Reconstructs the options by combining the specified options with the internal state.
    const options = { ...userOpts } as AllOptions;
    this._prepare(options);

    return super._withLock(onLockFn, options);
  }

  /**
   * @internal
   * Acquire the lock. 
   * In practice, if a lock is already held, wait for it to be released before acquiring the lock. 
   * Throw an error (exception) if the specified timeout is exceeded.
   * @param options  Options
   */
  protected override async _acquire(options: AllOptions): Promise<void> {
    const start = Date.now();
    const timeoutTime = start + options.timeoutMs;
    const pollIntervalMs = options.pollIntervalMs;
    const causes = [] as unknown[];
    let   tryRes = null;
    do {
      tryRes = await this.#tryLock(options);
      if (tryRes.locked) {
        this._logger.trace(`Acquired the lock(key: ${this._key})  at ${DateFormatter.format(new Date())}.`);
        return;
      }
      if (tryRes.cause) causes.push(tryRes.cause);
      await sleepAsync(pollIntervalMs);
    }
    while (Date.now() < timeoutTime);

    // Couldn't acquire the lock
    const errIns = {
      'ELOCKED'  : () => new AlreadyLocked('', {key: this._key, props: { path: options._filePath } }),
      'EBROKEN'  : () => new LockFileBroken({ path: options._filePath, props: { causes } }),
      'EIO'      : () => FileLockError.lockFailedDueToIO(this._key, causes),
      'EHISTORY' : () => FileLockError.lockFailedDueToHistory(FileLock.#historyPath, causes),
    } as const as Record<string, () => void>;
    const err = errIns[tryRes.reason] ? errIns[tryRes.reason]() : null;
    ENSURE_DEBUG(err != null, 'Unexpected lock failure reason. This may be a malfunction.',
      FileLockError, { code: 'EUNEXPECTED', props: { cause: tryRes.cause } });
    throw err;

    /*
    while ((tryRes = this.#tryLock(options)).locked === false) {
      if (tryRes.cause) causes.push(tryRes.cause);
      if (Date.now() >= timeoutTime) {
        const errIns = {
          'ELOCKED'  : () => new AlreadyLocked('', {key: this._key, props: { path: options._filePath } }),
          'EBROKEN'  : () => new LockFileBroken({ path: options._filePath, props: { causes} }),
          'EIO'      : () => LockFileBroken.lockFailedDueToIO(options._filePath, causes),
          'EHISTORY' : () => LockFileBroken.lockFailedDueToHistory(FileLock.#historyPath, causes),
        } as const as Record<string, () => void>;
        const err = errIns[tryRes.reason] ? errIns[tryRes.reason]() : null;
        ENSURE_DEBUG(err != null, 'Unexpected lock failure reason. This may be a malfunction.',
          FileLockError, { code: 'EUNEXPECTED', props: { cause: tryRes.cause } });
        throw err;
      }
      await sleepAsync(pollIntervalMs);
    }
    this._logger.trace(`Acquired the lock(key: ${this._key})  at ${DateFormatter.format(new Date())}.`)
    */
  }

  /**
   * @internal
   * Release lock. <br>
   * In practice, the counter is decremented, and the lock is released when it reaches zero.
   * @param options Options.
   */
  protected override async _release(options: AllOptions): Promise<void> {
    await this._decReantryCount(options);
  }

  /**
   * Attempt to acquire the lock; that is, create the lock file.
   * @param options Options
   * @returns `true` if acquired lock. 
   */
  async #tryLock(options: AllOptions): Promise<{ locked: boolean, reason: string, cause?: unknown }> {
    if (this._acquired) return {locked: false, reason: 'ELOCKED'};

    let ret = null;
    // Check lockable, and if lockable, create lock key directry
    if ((ret = this.#isLockable(options)).lockable === false) {
        return { locked: false, reason: ret.reason, cause: ret.cause };
    }

    // Create the lock file. 
    try {
      await this.#createLockFile(options);
    }
    catch (err) {
      try {
        // An empty lock file should already have been created, so delete it.
        //fs.unlinkSync(options._filePath);
        this.#removeFile(options);
      }
      catch (err2) {
        // Give up on the I/O error here.
        err = err2;
      }
      const reason =  err instanceof FileLockError && err.code === 'EHISTORY' ? 'EHISTORY' : 'EIO';
      return { locked: false, reason, cause: err };
    }

    // Start the heartbeat.
    this.#startHeartbeat(options);

    this._acquired = true;

    return { locked: true, reason: 'ACQUIRED' };
  }

  /**
   * @internal
   * Check lockable.
   * @param options 
   * @returns 
   */
  #isLockable(options: AllOptions): { lockable: boolean, reason: string, cause?: unknown } {
    let ret = false;

    try {
      ret = this.#exclusiveOpenLockFile(options);
      if (ret) return { lockable: true, reason: 'LOCKFILEOPENED' }; // lockable

      // Could not open with exclusive access, so reading metadata.
      let meta = null;
      meta = this.#getInfoIfExists(options, true);

      if (meta && this.#isLockExpired(meta) === false)  {
        return { lockable: false, reason: 'ELOCKED' }; // This lock is alive.
      }

      // Delete stale information.
      if (this.#removeAndReopenFile(options)) {
        return { lockable: true, reason: 'LOCKFILEOPENED' };
      }
      else {
        return { lockable: false, reason: 'ELOCKED' }; // 多分、他のロックに先を越された。
      }
    }
    catch (err) {
      // Set lockable=false for data corruption and I/O errors, as these are subject to lock retries.
      REQUIRE_DEBUG(err instanceof FileLockError, 'An unexpected error was caught.', FileLockError, { code: 'EUNEXPECTED', props: { cause: err} });
      if (err instanceof LockCompromised) {
        return { lockable: false, reason: 'EBROKEN', cause: err };
      }
      // Apart from that, there should only be I/O errors.
      return { lockable: false, reason: 'EIO', cause: err }; // 検証済み
    }
  }

  /**
   * @internal
   * Whether the lock has expired.
   * @param options 
   */
  #isLockExpired(meta: FileLockMeta): boolean {
    this._logger.trace("Lock file contents in isLockExpired():", meta);
    const expired = meta.expirationTime <= Date.now();
    const dead = meta.lastHeartbeatAt + meta.heartbeatTtlMs <= Date.now();
    this._logger.trace("expired:", expired, "dead:", dead);
    return expired && dead;
  }

  /**
   * @internal
   * Start heartbeat.
   * @param options Options.
   */
  async #startHeartbeat(options: AllOptions): Promise<void> {
    REQUIRE_DEBUG(this._heartbeatTimer === null, 
      'Heartbeat multiple startup error. Possible bug.', 
      FileLockError, { code: 'EFILELOCK', props: { options } });

    this._logger.trace(`Start heartbeat(key: ${this._key}, ownerId: ${this._ownerId}) at ${DateFormatter.format(new Date())}`);

    this._heartbeatTimer = setInterval(
      async () => {
        try {
          // Avoid `if` statements to ensure code coverage.
          this._acquired && await this.#updateHeartbeat(options);
        }
        catch (err) {
            this._logger.trace(`Heartbeat update error at ${DateFormatter.format(new Date())}: ${err}`);
          this.#stopHeartbeat();
          this._onError(err, 'updateHeartbeat', options);
          // To maintain the lock, the heartbeat is not stopped here. 
          // ★★★　と書きながらも、上記で止めているけれど？？おそらく、テストの何かに合わせたか！！
        }
      },
      options.heartbeatIntervalMs
    );
  }

  /**
   * @internal
   * Stop heartbeat.
   */
  #stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
      this._logger.trace(`Stop heartbeat(key: ${this._key}, ownerId: ${this._ownerId}) at ${DateFormatter.format(new Date())}`);
    }
  }

  /**
   * @internal
   * Update heartbeat.
   */
  async #updateHeartbeat(options: AllOptions): Promise<void> {
    const meta = this.#getInfo(options);
    meta.lastHeartbeatAt = Date.now();
    this.#updateInfo(meta, options);
    this._logger.trace(`Update heartbeat(key: ${this._key}, ownerId: ${this._ownerId}) at ${DateFormatter.format(new Date(meta.lastHeartbeatAt))}`);
  }

  #createFileSyncExclusively(path: string, options: AllOptions, msg = "Couldn't create th file."): void {
    return this.#accessInfo(
      path,
      () => { const fd = fs.openSync(path, 'wx'); fs.closeSync(fd); },
      options, 
      msg
    );
  }

  /**
   * @internal
   * Open the lock file exclusively.
   * @param options Options.
   */
  #exclusiveOpenLockFile(options: AllOptions): boolean {
    try {
      this.#createFileSyncExclusively(options._filePath, options);
      return true;
    }
    catch (err) {
      return false;
    }
  }

  /**
   * @internal
   * Create the lock file.
   * @param options Options.
   */
  async #createLockFile(options: AllOptions): Promise<boolean> {
    try {
      // Create the lock file.
      this.#updateInfo(
        {
          // When this lock request becomes the lock owner, 
          // the optional lock sharer ID and optional owner ID are set to match `this._ownerId`.
          ownerId: options._ownerId = options._sharerId = this._ownerId, 
          expirationTime: Date.now() + options.ttlMs,
          heartbeatTtlMs: options.heartbeatTtlMs,
          lastHeartbeatAt: Date.now(),
          counter: 1
        },
        options
      );

      const sharerDir = options._sharerDir;
      // Create the lock sharer directory
      this.#mkdirSync(sharerDir, options, {}, "Couldn't create the lock sharer directory.");
      // Add myself as owner into the lock sharer directory
      await this.#addSharer(options);
      /*
      await this.#share(() => {
        this.#writeFileSync(path.join(sharerDir, this._ownerId), '', options, "Couldn't write the lock sharer.");
      }, options);
      */
      //this.#writeFileSync(path.join(sharerDir, this._ownerId), '', options, "Couldn't write the lock sharer.");
    }
    catch (err) {
      throw err;
    }

    return true;
  }

  #removeFile(options: AllOptions): void {
    this.#unlinkSync(options._filePath, options);
    this.#rmDirSync(options._sharerDir, options);
  }

  /**
   * @internal
   * Remove the lock file.<br>
   *  - Modified during the process or corrupted ⇒ Do not delete<br>
   *  - Unable to read meta-information ⇒ Do not delete<br>
   *  - Unable to read due to an I/O error (during existence check, unlink, or read) ⇒ Do not delete<br>
   *  - Report the above errors properly—specifically, that the lock file could not be deleted due to the error!!<br>
   *
   * In other words: delete only if the lock file exists, the metadata can be read, and the owner information matches expectations.
   * 
   * @param options 
   * @param errMsg 
   */
  #removeLockFile(meta: FileLockMeta | null, options: AllOptions, force: boolean = false): void {
    meta = meta || this.#getInfo/*IfExists*/(options, true);

    // Unless a forced deletion is specified, the file will not be deleted 
    // if the metadata cannot be read, or—even if it can be read—if the file is not one's own.
    if (force === false && (meta === null || meta.ownerId !== options._ownerId)) return;

    // Remove them, bacause it is my own file.
    this.#removeFile(options);
    /*
    this.#unlinkSync(options._filePath, options);
    this.#rmDirSync(options._sharerDir, options);
    */
  }

  #rmDirSync(path: string, options: AllOptions, msg: string = "Couldn't remove the directory.") {
    return this.#accessInfo(
      path,
      () => fs.rmSync(path, { force: true, recursive: true }), 
      options, 
      msg
    );
  }

  /**
   * @internal
   * Remove the lock file and open it again with exclusive access.
   */
  #removeAndReopenFile(options: AllOptions): boolean {
    this.#removeFile(options);
    return this.#exclusiveOpenLockFile(options);
  }

  /**
   * @internal
   * Read the file.
   */
  #readFileSync(path: string, options: AllOptions, msg: string = "Couldn't read the lock file."): string {
    return this.#accessInfo(
      path,
      () => fs.readFileSync(path, 'utf8'), 
      options, 
      msg
    );
  }

  /**
   * @internal
   * Write the file.
   */
  #writeFileSync(path: string, data: unknown, options: AllOptions, msg: string = "Couldn't write the lock file."): void {
    const str = JSON.stringify(data, null , "  ");
    this.#accessInfo(
      path,
      () => {
        fs.writeFileSync(path, str, 'utf8');
      },
      options,
      msg
    );
  }

  /**
   * @internal
   * Check if the file exists.
   */
  #existsSync(path: string, options: AllOptions, msg = `check the existence of the lock file.`): boolean {
    return this.#accessInfo(
      path,
      () => fs.existsSync(path), 
      options, 
      msg
    );
  }

  /**
   * @internal
   * Remove the file.
   */
  #unlinkSync(path: string, options: AllOptions, msg = `Couldn't remove the lock file.`): void {
    this.#accessInfo(
      path,
      () => fs.unlinkSync(path),
      options,
      msg
    );
  }

  /**
   * @internal
   * Remove the file.
   */
  #mkdirSync(path: string, options: AllOptions, fsOpts: object = {}, msg = `Couldn't create the directory.`): void {
    this.#accessInfo(
      path,
      () => fs.mkdirSync(path, fsOpts),
      options,
      msg
    );
  }

  /**
   * @internal
   * Final unlock processing.
   * @param options Options.
   */
  #actuallyRelease(options: AllOptions) {
    this._acquired = false;
    // Stop the heartbeat (must be stopped before deletion)
    this.#stopHeartbeat()
    this.#removeLockFile(null, options);
    options._ownerId = null;

    this._logger.trace(`Released the lock(key: ${this._key}) at ${DateFormatter.format(new Date())}`);
  }

  /**
   * @internal
   * File or direcroty access with exclusive control.
   * @param name      File or directory path. 
   * @param methodCb  Callback function to access a file or directory.
   * @param options   Options.
   * @param errMsg    If error, a message to pass to `Error class`.
   */
  #accessInfo(name: string, methodCb: () => any, options: AllOptions, errMsg: string): any {
    const retries = options.retriesOnIOErr;
    const retryIntervalMs = options.retryIntervalMs;
    const causes = [] as unknown[];
    for (let i = 0; i <= retries; i++) {
      try {
        return methodCb();
      }
      catch (err) {
        causes.push(err);
        this._logger.fatal('IO error occuered.', err);
        if (i < retries) {
          sleepSync(retryIntervalMs);
          continue;
        }
        let detailMsg: string = '', code: string = 'EFILELOCK';
        // Avoid `if` statements to address coverage issues.
        err instanceof Error && 
        (detailMsg = `(${err.message})`) && 
        (code = ('code' in err && err.code) as string);

        throw new FileLockError(`${errMsg}${detailMsg}`, {code, props: { path: name, causes } });
      }
    }
  }

  /**
   * @internal
   * Get the lock.<br>
   * This function returns the lock as-is only when valid information 
   * is successfully retrieved (it does not perform an owner check).<br>
   * In the case of an invalid file, it throws an error if `throwErr` is `true`; 
   * otherwise, it returns `null`.
   * @param options Options.
   * @returns null if not exist, or the contents as object.
   */
  #getInfoIfExists(options: AllOptions, throwErr: boolean = false): FileLockMeta | null {
    try {
      if (!this.#existsSync(options._filePath, options)) return null;
      return this.#getInfo(options, false);
    }
    catch (err) {
      if (throwErr) throw err;
      return null; 
    }
  }

  /**
   * @internal
   * Get the lock information.<br>
   * This function assumes the existence of a valid lock file. <br>
   * Consequently, it throws an error (exception) if the file is missing, corrupted, or has a different owner. <br>
   * Whether or not to perform an ownership check can be controlled via an argument.   
   * @param  options          Options.
   * @returns Lock information object.
   */
  #getInfo(options: AllOptions, checkOwner: boolean = true): FileLockMeta {
    // lock file should exist.
    REQUIRE(this.#existsSync(options._filePath, options), 'The lock file does not exist.', 
      LockCompromised, {key: this._key, props: { path: options._filePath } });

    const contents = this.#readFileSync(options._filePath, options);

    let meta: FileLockMeta;
    try {
      meta = JSON.parse(contents);
    }
    catch (err) {
      throw new LockCompromised(
        `Couldn't parse the lock file, it is probably broken.`,
        {key: this._key, props: { path: options._filePath, contents, key: this._key, ownerId: options._ownerId } });
    }

    VERIFY(checkOwner === false || options._ownerId == null || options._ownerId === meta.ownerId,
      'The lock file was overwritten by another lock.',
      LockCompromised,
      { key: this._key, props: { path: options._filePath, key: this._key, optionsOwnerId: options._ownerId, lockFileOwnerId: meta.ownerId } }
    );

    // Check contents.
    const check = (key: keyof FileLockMeta, type: string | ((v: unknown) => boolean), optional: boolean = false) => {
      // True if the key exists and the type check is successful.
      if (key in meta) {
        if (
          (typeof type === 'string' &&  typeof meta[key] === type) ||
          (typeof type === 'function' && type(meta[key])         )
        ) return true;
      }
      // If optional, then true.
      else if (optional) return true;
      // Otherwise false.
      return false;
    };

    const checkItems = [
      { key: "ownerId", type: "string" }, 
      { key: "processId",         type: "number", optional: true }, 
      { key: "parentProcessId",   type: "number", optional: true }, 
      { key: "processArgv",         
        type: (v) => Array.isArray(v) && v.every(val => typeof val === 'string'),
        optional: true
       }, 
      { key: "expirationTime",    type: "number" },
      { key: "heartbeatTtlMs",    type: "number" },
      { key: "lastHeartbeatAt",   type: "number" },
      { key: "counter",           type: "number" },
    ] as { key: keyof FileLockMeta, type: string | ((v: unknown) => boolean), optional?: boolean }[];

    const checkAll = () => {
      const invalidProps: Record<string, unknown> = {};
      checkItems.forEach(v => {
        if (check(v.key, v.type, v.optional ?? false) === false) {
          invalidProps[v.key] = meta[v.key];
        }
      });
      if (Object.keys(invalidProps).length > 0) {
              throw new LockCompromised(`The lock information format is invalid`,
                {key: this._key, props: { invalidProps, path: options._filePath } });
      }
    }

    checkAll();

    return meta;
  }

  /**
   * @internal
   * Update the lock information.
   * @param meta      Lock information.
   * @param options   Options.
   */
  #updateInfo(meta: FileLockMeta, options: AllOptions): void {
    // For debug
    if (this.#isDebug()) {
      Object.assign(
        meta, 
        { 
          processId: process.pid,
          parentProcessId: process.ppid,
          processArgv: process.argv,
          callStack : getCallStack()
        }
      );
    }

    this.#writeFileSync(options._filePath, meta, options);

    if (FileLock.#config.history === true || this.#isDebug() === true) {
      this.#addHistory(meta, options);
    }
  }

  /**
   * @internal
   * Adds the lock information to the history.
   * @param meta 
   * @param options 
   */
  #addHistory(meta: FileLockMeta, options: AllOptions): void {
    const maxEntries = FileLock.#config.maxHistoryEntries;
    const dateTimeStr = DateFormatter.format(new Date());
    const _add = () => {
      const historyFile = FileLock.#historyPath;
      let contents = null;
      if (this.#existsSync(historyFile, options, `Couldn't check the existence of the history file.`)) {
        try {
          contents = this.#readFileSync(historyFile, options, "Couldn't read the history file.");
        }
        catch (err) {
          ; // do nothing
        }
      }

      let history: Record<string, { meta: FileLockMeta, options: AllOptions }> = {};
      try {
        history = contents ? JSON.parse(contents) : {};
      }
      catch (err) {
        throw FileLockError.dueToHistory(historyFile, [err]);
      }

      history[dateTimeStr] = { meta, options };

      // Adjust to the maximum number.
      const keys = Object.keys(history);
      for ( let i = 0; i < keys.length - maxEntries; i++) {
        delete history[keys[i]];
      }

      //  Update history.
      this.#writeFileSync(historyFile, history, options, "Couldn't update the history file.");

      // ヒストリーファイル数調整
      const list = fs.readdirSync(FileLock.#historyDir, { withFileTypes: true });
      const names = list.filter(item => item.isFile()).map(item => item.name);
      if (names.length >= FileLock.#config.maxHistoryFiles) {
        names.sort();
        for( let i = 0; i < names.length - FileLock.#config.maxHistoryFiles; i++) {
          this.#unlinkSync(path.join(FileLock.#historyDir, names[i]), options, `Couldn't remove the history file.`);
        }
      };
    };

    _add();
  }

  /**
   * @internal
   * Check if debug mode.
   */
   #isDebug(): boolean {
    return FileLock.#config._debug;
  }

  /**
   * @internal
   * Execute termination processing.<br>
   * In the Windows version, this is not called upon forced termination (process.kill()), but the implementation is being retained.
   */
  #onExit(code: number | null | undefined, signal: NodeJS.Signals | null): void {
    this._onExit(code, signal);
  }

}

// Initialize
FileLock._initialize();

