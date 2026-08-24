import path from 'node:path';
import fs from 'node:fs';

import plockfile from 'proper-lockfile';
// Define proper-lockfile's withLock
const PLockFile = {
  withLock(file: string, cb: () => void, opts: plockfile.LockOptions) {
    plockfile.lockSync(file, opts);
    try {
      return cb();
    }
    finally {
      plockfile.unlockSync(file, opts);
    }
  }
}

import { LRUCache } from 'lru-cache';
import { DateFormatter } from '@ayapapa-npm/date-formatter-js';
import { Contracts } from '@ayapapa-npm/contracts-js';
const { REQUIRE, REQUIRE_DEBUG } = Contracts;

import { LockBase, sleepAsync, sleepSync, type CallbackOnLock, type Config as BaseConfig, type LogProvider } from "./LockBase.ts";
import { FileLockUserOptions } from './FileLockUserOptions.ts';
import { type FileLockInternalState } from './FileLockInternalState.ts';
import { FileLockUserOptionsResolver, typedKeys } from "./FileLockUserOptionsResolver.ts";
import {  AlreadyLocked, CallStack, FileLockError, InvalidOptions, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed, TTLExceeded } from './FileLockErrors.ts';
import { type AllOptions as AllOptionsT } from './AllOptions.ts';

type AllOptions = AllOptionsT<FileLockUserOptions, FileLockInternalState>;

/**
 * FileLock cofiguration. 
 */
export interface Config extends BaseConfig {
  /**
   * Specifies the directory path to stored locking imformations.
   * If it has been specified, use this as the top priority.
   * The directory is determined based on the following order of priority:<br>
   *  1. Specified via an `Config` (user's explicit intent)
   *  2. `process.cwd()` (current working directory at runtime)
   * Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.
   */
  lockDirectory?: string;

  /** 
   * Whether to enable caching for FileLock instances associated with a key.
   * Default is `true`.
   */
  cache?: boolean;

  /**
   * Maximum number that can be cached. 
   * If unspecified, or negative, there is no upper limit. `0` means `cache` is disabled, even if `cache` is true.
   * Default is `100`.
   */
  cacheMaxNum?: number;

  /**
   * User default options used with `withLock()`.
   * Default is the return value of `FileLock.getDefaultOptions()`.. 
   */
  defaultOptions?: FileLockUserOptions;
}

/** Lock-related information */
interface LockMetaData {
  ownerId: string
  expirationTime: number,
  heartbeatTimeoutMs: number,
  lastHeartbeatAt: number,
  counter: number
}

/**
* File locking. 
* Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
* While the file exists, no other lock can be acquired for the same key. 
* Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed. 
*/
export class FileLock extends LockBase<FileLockUserOptions, FileLockInternalState> {
 
  /** 
   * Static fields 
   */

  /** Default configuration. */
  private static readonly defaultConfig: Config = {
    cache: true,
    cacheMaxNum: 100,
    defaultOptions: FileLock.getDefaultOptions()
  };

  /** Current configuration. */
  private static config: Config = FileLock.defaultConfig;

  /** Whether or not initialization has been performed. */
  private static initialized: boolean = false;

  /**
   * FileLock instance cache associated with a key. 
   * Uses `LRUCache`, providing features to set a maximum cache size and prune (remove) infrequently accessed elements.
   */
  private static cache: LRUCache<string, FileLock> | null;


  /** 
   * Static methods
   */

  /** Initialize. */
  public static initialize() {
    FileLock.resetConfig();
    FileLock.initialized = true;
  }

  /**
   * Set `Config`.
   * At the same time, the cache is cleared.
   * @param config 
   */
  public static setConfig(config: Config): void {
    const dConf = FileLock.#copyConfig(config);
    FileLock.config = { ...FileLock.getDefaultConfig(), ...dConf };
    if (FileLock.config.cacheMaxNum === 0) FileLock.config.cache = false;

    // Clear chache
    FileLock.clearCache();

    // If cache is enabled, (Re)create cache.
    if (FileLock.config.cache) {
      const opts: LRUCache.Options<string, FileLock, unknown> = {} as any;
      if (FileLock.config.cacheMaxNum && FileLock.config.cacheMaxNum > 0) {
        opts.max = FileLock.config.cacheMaxNum;
      }
      opts.ttl = 50000;
      FileLock.cache = new LRUCache<string, FileLock>(opts);
    }
    // or set null to chache.
    else FileLock.cache = null;
  }

  /** Reset `Config`. */
  public static resetConfig(): void {
    FileLock.setConfig(FileLock.getDefaultConfig());
  }

  /** GEt current `Config`. */
  public static getConfig(): Config {
    return FileLock.#copyConfig(FileLock.config);
  }

  /** Get default `COnfig`. */
  public static getDefaultConfig(): Config {
    return FileLock.#copyConfig(FileLock.defaultConfig);
  }

  /**
   * Acquires a lock for the specified key,
   * executes the function `onLockFn` under exclusive control, and returns a Promise that resolves with the return value of `onLockFn` after the lock is released. 
   *
   * @param key       Lock key.
   * @param onLockFn  Callback function to execute while the lock is held.
   * @param options   Options
   * @return A Promise that resolves with the return value of onLockFn.
   */
  public static async withLock(key: string, onLockFn: CallbackOnLock, options: FileLockUserOptions  = {}): Promise<any> {
    REQUIRE(Boolean(key), 'Must specify `key`.', FileLockError, { code: 'EINVAL' });
    const rOpt = new FileLockUserOptionsResolver(options, FileLock.config?.defaultOptions).getOptions();
    return FileLock.getLock(key).withLock(onLockFn, rOpt);
  }

  /**
   * Get default options(`FileLockUserOptions`).
   * @returns Deault options.
   */
  public static getDefaultOptions(): FileLockUserOptions  {
    return FileLockUserOptionsResolver.getDefaultOptions();
  }

  /** Clear `lock` instance cache. */
  public static clearCache() {
    if (FileLock.cache) FileLock.cache.clear();
  }

  /**
   * Get `lock` instance.
   * @param key Lock key. 
   */
  private static getLock(key: string): FileLock {
    if (FileLock.#hasCache(key)) {
      return FileLock.cache?.get(key) as FileLock;
    }
    const lock = new FileLock(key);
    FileLock.#setCache(key, lock);
    return lock;
  }

  /**
   * Get a directory path for storing files containing lock information.
   * If it has been specified, use this as the top priority.
   * The directory is determined based on the following order of priority:<br>
   *  1. Specified via an `Config` (user's explicit intent)
   *  2. `process.cwd()` (current working directory at runtime)
   * Note: In cases where the directory is explicitly specified (1 or 2 above), an error occurs if the specified directory does not exist and its creation fails.
   * @returns A directory path for storing files containing lock information.
   */
  private static getLockDirPath() {
    const existsDir = (name: string): boolean => {
      try {
        const stat = fs.statSync(name);
        if (stat.isDirectory()) return true;
        throw Object.assign(new Error(`'${name}' is not a directory.`), { code: 'ENOTDIR' });
      }
      catch (err: any) {
        if (err.code === 'ENOENT') return false;
        throw new LockDirectoryStatFailed(err.message, { path: name, props: { fsErrorCode: err.code } } );
      }
    }

    const mkdir = (name: string): void => {
      try {
        fs.mkdirSync(name,  { recursive: true });
      }
      catch (err: any) {
        throw new LockDirectoryCreationFailed(err.message, { path: name, props: { path: name, fsErrorCode: err.code } });
      }
    }

    const candies = {
      'config.lockDirectory' : FileLock.config.lockDirectory,
      'process.cwd()': path.join(process.cwd(), '.lock'),
    };

    const isSpecified = (i: number) => i === 0;

    let candidates: string = '';
    const keys = typedKeys(candies);
    for(let i = 0; i < keys.length; i++) {
      const dir = candies[keys[i]];
      if (!dir) continue;
      candidates += "\n" + `- ${dir}`;
      try {
        if (existsDir(dir)) return dir;
        mkdir(dir);
        return dir;
      }
      catch (err) {
        if (isSpecified(i)) throw err;
        continue;
      }
    };
    throw new LockDirectoryCreationFailed(
      "Failed to create the lock information storage directory." +
      "\nAttempted to locate and create it in the following order:" +
      candidates,
      { props: { candidates } }
    );
  }

  /**
   * Whether the instance corresponding to `key` is cached. 
   * @param key Lock key. 
   */
  static #hasCache(key: string): boolean {
    return FileLock.cache != null && FileLock.cache.has(key);
  }

  /**
   * Whether the instance corresponding to `key` is cached. 
   * @param key   Lock key. 
   * @param lock  Lock instance. 
   */
  static #setCache(key: string, lock: FileLock): void  {
    if (FileLock.cache) FileLock.cache.set(key, lock);
  }

  /** Copy config. */
  static #copyConfig(config: Config): Config {
    const ret = { ...config };
    if (config.defaultOptions) ret.defaultOptions = { ...config.defaultOptions };
    return ret;
  }


  /** 
   * Instance fields.
   */

  /** Heartbeat timer id */
  #heartbeatTimer?: NodeJS.Timeout | null;

  /** Whether or not it is released */
  #released: boolean = true;


  /** 
   * Instance methods.
   */

  /**
   * Constructor.
   * @param {string}  key  
   */
  private constructor(key: string) {
    super(key, FileLock.config);
  }

  /**
   * Increment lock counter.
   * @param options 
   */
  protected override incReantryCount(options: AllOptions) {
    const meta = this.#getMeta(options);
    options.ownerId =  options.ownerId || meta.ownerId;
    meta.counter = meta.counter || 0;
    meta.counter++;
    this.#setMeta(options, meta);
  }

  /**
   * Decrement lock counter.
   * And, when the counter becomes '0', release lock.
   * @param options 
   */
  protected override decReantryCount(options: AllOptions) {
    let meta;
    try {
      meta = this.#getMeta(options);
      if (options.ownerId === meta.ownerId) {
        if (meta.counter > 0) meta.counter--;
        this.#setMeta(options, meta);
      }
    }
    catch (err) {
      this.onError(err, 'getMeta', options);
      this.#release(options);
      throw err;
    }
    if (meta && meta.counter === 0) {
      this.#release(options);
    }
  }

  /**
   * Make advance preparations.
   * @param options Options
   */
  protected override prepare(options: AllOptions): void {
    super.prepare(options);
    if (FileLock.initialized !== true) FileLock.initialize(); // Just in case
    const  dirPath    = FileLock.getLockDirPath();
    const baseFilePath = path.join(dirPath, this.key);
    options.filePath     = baseFilePath + '.json';
  }

  /**
   * Acquires a lock, executes the function `onLockFn` under exclusive control, 
   * and returns a Promise that resolves with the return value of `onLockFn` after the lock is released. 
   *
   * @param onLockFn  Callback function to execute while the lock is held.
   * @param options   Options
   * @return A Promise that resolves with the return value of onLockFn.
   */
  private async withLock(onLockFn: CallbackOnLock, options: AllOptions): Promise<any> {
    REQUIRE_DEBUG(options.resolved, "The option remains unresolved.", InvalidOptions, { props: options });

    this.prepare(options);

    return super._withLock(
      onLockFn,

      async (cb, opts) => { // `cb` is a callback in the parent class that wraps `onLockFn`.

        await this.#lock(opts);

        // Create TTL timer
        let ttlTimeoutId: NodeJS.Timeout;
        const timeoutPr = new Promise((_, reject) => {
          ttlTimeoutId = setTimeout(() => {
            reject(new TTLExceeded(null, { ttlMs: opts.ttlMs as any }))
          },
          opts.ttlMs);
        });

        // A race between callback processing and the TTL timer.
        try {
          return await Promise.race([cb(), timeoutPr])
            .finally(() => { // In any case, turn off the timer.
              if (ttlTimeoutId !== undefined) clearTimeout(ttlTimeoutId);
            }
          );
        }
        catch (err) {
          this.onError(err, 'Callback or Timer in withLock()', opts);
          throw err;
        }
        finally {
          this.#unlock(opts);
        }
      },
      options
    );

  }

  /**
   * Acquire the lock. 
   * In practice, if a lock is already held, wait for it to be released before acquiring the lock. 
   * Throw an error (exception) if the specified timeout is exceeded.
   * @param options  Options
   */
  async #lock(options: AllOptions): Promise<void> {
    const start = Date.now();
    const timeoutTime = start + (options.timeoutMs as any);
    while (!this.#tryLock(options)) {
      if (Date.now() >= timeoutTime) {
        throw new AlreadyLocked('', {key: this.key, props: { file: options.filePath } });
      }
      await sleepAsync(options.pollIntervalMs as any);
    }
  }

  /**
   * ファイル生成。
   * ★★★、、、、proper-filelockの使い道を再検討せよ！　そもそも、これをつかって、最初にロックを試みて、だめなら、待つ！　そのうえで、自前のロック情報の中身をみる。。。ロック中は、このproper-filelockもロックを外さない。
   * つまり、２重ロック厳格さを導入するのである。
   * @param options Options.
   */
  #createFile(options: AllOptions) {
    const ttlMs: number = options.ttlMs ?? FileLock.getDefaultOptions().ttlMs as any;
    const heartbeatTimeoutMs: number = options.heartbeatTimeoutMs as any
    this.#setMeta(
      options,
      {
        ownerId: options.ownerId = crypto.randomUUID(),
        expirationTime: Date.now() + ttlMs,
        heartbeatTimeoutMs: heartbeatTimeoutMs,
        lastHeartbeatAt: Date.now(),
        counter: 1
      },
      true
    );
  }

  /**
   * Attempt to acquire the lock; that is, create the lock information file.
   * @param options Options
   * @returns `true` if acquired lock. 
   */
  #tryLock(options: AllOptions): boolean {
    if (this.#released === false) return false;

    if (fs.existsSync(options.filePath)) {
      if (!this.#isLockExpired(options)) return false; // This lock is alive.
    }

    // Create lock information file.
    this.#createFile(options);

    this.logger.trace('lockMeta: CreatedLockFile', 
      new CallStack({ props:{ key: this.key, ownerId: options.ownerId }
    }));

    this.#startHeartbeat(options);

    this.#released = false;

    return true; // Completed lock.
  }

  /**
   * Release lock. 
   * In practice, the counter is decremented, and the lock is released when it reaches zero.
   * @param options Options.
   */
  #unlock(options: AllOptions): void {
    this.decReantryCount(options);
  }

  /**
   * Whether the lock has expired.
   * @param options 
   */
  #isLockExpired(options: AllOptions): boolean {
    const meta = this.#getMetaOrNull(options);
    const expired = !meta || meta.expirationTime < Date.now();
    const dead = !meta || meta.lastHeartbeatAt + meta.heartbeatTimeoutMs < Date.now();
    return expired && dead;
  }

  /**
   * Start heartbeat.
   * @param options Options.
   */
  #startHeartbeat(options: AllOptions): void {
    if (this.#heartbeatTimer) return; // Preventing Multiple Instances.
    this.logger.trace(`start heartbeat at ${DateFormatter.format(new Date())}`);
    this.#heartbeatTimer = setInterval(
      async () => {
        if (this.#released) return this.#stopHeartbeat();
        try {
          this.#updateHeartbeat(options);
        }
        catch (err) {
          this.logger.trace(`heartbeat update error at ${DateFormatter.format(new Date())}: ${err}`);
          this.onError(err, 'updateHeartbeat', options);
          // To maintain the lock, the heartbeat is not stopped here.
        }
        // Therefore, the lock-released flag is checked even after the update.
        if (this.#released) return this.#stopHeartbeat();
      },
      options.heartbeatIntervalMs
    );
  }

  /**
   * Stop heartbeat.
   */
  #stopHeartbeat(): void {
    if (this.#heartbeatTimer) {
      this.logger.trace(`stop heartbeat at ${DateFormatter.format(new Date())}`);
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  /**
   * Update heartbeat.
   */
  #updateHeartbeat(options: AllOptions) {
    const meta = this.#getMeta(options);
    meta.lastHeartbeatAt = Date.now();
    this.#setMeta(options, meta);
    this.logger.trace(`update heartbeat at ${DateFormatter.format(new Date(meta.lastHeartbeatAt))}`);
  }

  /**
   * Remove the lock information storage file.
   * @param options 
   * @param errMsg 
   */
  #removeFile(options: AllOptions, errMsg?: string): void {
    let meta;
    try {
      meta = this.#getMetaOrNull(options);
      if (!meta) return;
    }
    catch (err) {
      return;
    }
    if (meta.ownerId !== options.ownerId) return; // It's compromised, so do not release it.

    // Remove.
    return this.#accessMetaWithLock(
      options.filePath,
      (name) => fs.rmSync(name/*,  {recursive: true, force: true}*/),
      options,
      errMsg || `Couldn't remove the lock information storage file.`
    );
  };

  /**
   * Final unlock processing.
   * @param options オプション。
   */
  #release(options: AllOptions) {
    //if (options.release) options.release();
    this.#removeFile(options);

    this.#stopHeartbeat()

    //delete options.release;
    options.ownerId = null;
    //this.ownerId = null;
    this.#released = true;
  }

  /**
   * File or direcroty access with exclusive control.
   * @param name      File or directory path. 
   * @param methodCb  Callback function to access a file or directory.
   * @param options   Options.
   * @param errMsg    If error, a message to pass to `Error class`.
   */
  #accessMetaWithLock(name: string, methodCb: (name:string) => any, options: AllOptions, errMsg: string | null = null): any {
    let retries = options.retriesOnIOErr as any + 1;
    while (retries >= 0) {
      try {
        return PLockFile.withLock(
          name, 
          () => methodCb(name),
          {realpath: false} // lockSyncなのでretriesは指定できない（エラー）
        );
      }
      catch (err: any) {
        if (retries--) {
          sleepSync(options.retryIntervalMs as any);
          continue;
        }
        if (err.code === 'ELOCKED') {
          throw new AlreadyLocked('', { key: this.key, props: { file: name } });
        }
        errMsg = errMsg || `An access error occurred for the lock information storage file.`;
        throw new FileLockError(`${errMsg}(${err.message})`, {code: err.code, props: { file: name } });
      }
    }
  }

  /**
   * Get the lock information storage file's contents as object.
   * @param options Options
   * @returns null if not exist, or the contents as object.
   */
  #getMetaOrNull(options: AllOptions): LockMetaData | null {
    if (!fs.existsSync(options.filePath)) {
      return null;
    }
     return this.#getMeta(options);
  }

  /**
   * Get the lock information
   * @param  options          Options.
   * @returns Lock information object.
   */
  #getMeta(options: AllOptions): LockMetaData {
    if (!fs.existsSync(options.filePath)) {
      throw new LockCompromised('The lock information storage file does not exist.', {key: this.key, props: { file: options.filePath } });
    }

    const contents = this.#accessMetaWithLock(
      options.filePath,
      (name: string) => fs.readFileSync(name), 
      options, 
      `Couldn't read the lock information storage file..`
    );

    const meta: LockMetaData = contents ? JSON.parse(contents) : {};

    if(options.ownerId && options.ownerId !== meta.ownerId) {
      const err = new LockCompromised(
        'The lock information storage file was overwritten by another lock.',
        {key: this.key, props: { file: options.filePath, key: this.key, optionsOwnerId: options.ownerId, /*instanceId: this.ownerId, */lockFileOwnerId: meta.ownerId } });
      this.logger.error(err);
      throw err;
    }

    // Check contents.
    const check = (key: keyof LockMetaData, type: string) => {
      if (!(key in meta && typeof meta[key] === type)) {
        throw new LockCompromised(`The lock information format is invalid.`, {key: this.key, props: { file: options.filePath } });
      }
    };

    check("ownerId",             "string"); 
    check("expirationTime",      "number");
    check("heartbeatTimeoutMs",  "number");
    check("lastHeartbeatAt",     "number");
    check("counter",             "number");
    return meta;
  }

  /**
   * Set the lock information to file.
   * @param options   Options.
   * @param meta      Lock information.
   * @param withLock  ロックするか否か。。。たぶん、今後不要！
   */
  #setMeta(options: AllOptions, meta: LockMetaData, withLock: boolean = true) {
    try {
      if (!withLock) {
        fs.writeFileSync(options.filePath, JSON.stringify(meta));
      }
      else {
        this.#accessMetaWithLock(
          options.filePath,
          (name: string) => fs.writeFileSync(name, JSON.stringify(meta)),
          options,
          `Couldn't write the lock information storage file`
        );
      }
    }
    catch (err: any) {
      if (err instanceof FileLockError === false) {
        err = new FileLockError("Couldn't remove the lock information storage file", {code: err.code, props: { file: options.filePath } });
      } 
      throw err;
    }
  }

}

// Initialize
FileLock.initialize();

export { LogProvider };