import path from 'node:path';
import fs from 'node:fs';
import { onExit } from 'signal-exit';

import { LRUCache } from 'lru-cache';
import { DateFormatter } from '@ayapapa-npm/date-formatter-js';
import { Contracts } from '@ayapapa-npm/contracts-js';
const { REQUIRE, REQUIRE_DEBUG } = Contracts;

import { LockBase, type CallbackOnLock } from "./LockBase.ts";
import { LockError } from "./LockBaseErrors.ts";
import { defaultFileLockOptions, minimumFileLockOptions, type FileLockRequiredOptions, type FileLockOptions } from './FileLockOptions.ts';
import { type FileLockInternalState } from './FileLockInternalState.ts';
import { FileLockOptionsResolver, typedKeys } from "./FileLockOptionsResolver.ts";
import {  AlreadyLocked, FileLockError, InvalidOptions, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed } from './FileLockErrors.ts';
import { type AllOptions as AllOptionsT } from './AllOptions.ts';
import { defaultFileLockConfig, type FileLockConfig } from './FileLockConfig.ts';
import { getCallStack, sleepAsync, sleepSync } from './Util.ts'
import { type FileLockMeta } from './FileLockMeta.ts'
import type { LogProvider } from './LockBaseConfig.ts';

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
   * 最近使ったオプション(static `withLock()`内で解決されたオプション）を保存する。
   * 本来は、`withLock()`の呼び出しごとに新しいオプションが解決されるため、staticに保存する必要はないが、テストのために保存する。
   */
  protected static _lastOptions: FileLockRequiredOptions | null = null;

  /**
   * @internal
   * Expiration time (milliseconds) for the lock information directory. 
   * 何らかの理由で、ロック情報格納ディレクトリ単独で残ってしまっている場合に備えて、その有効期限を設定する。
   * つまり、単独で1秒以上の存在するディレクトリは無効と判定される。
   */
  static readonly #fileDirExpirationMs: number = 1000; // 1 second

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
   * Logger.
   */
  static #logger: Required<LogProvider> = FileLock._resolveLogger(FileLock.#config);

  /** 
   * Static methods
   */

  /** Initialize. */
  public static initialize() {
    FileLock.resetConfig();
  }

  /**
   * Static methods.
   */

  /**
   * Set configurations.<br>
   * 現在設定の一部を書き換えると説明せよ！ see PrettyCOndole.
   * At the same time, the cache is cleared.
   * @param config 
   */
  public static setConfig(config: FileLockConfig): void {
    const dConf = FileLock.#copyConfig(config);
    if (dConf.cacheTtlMs != null) dConf.cacheTtlMs = Math.max(dConf.cacheTtlMs, defaultFileLockConfig.cacheTtlMs);
    if (dConf.cacheMaxNum != null) dConf.cacheMaxNum  = Math.max(dConf.cacheMaxNum, 0);
    if (dConf.maxHistoryEntries != null) dConf.maxHistoryEntries = Math.max(dConf.maxHistoryEntries, 0);

    // If defaultOptions is specified, resolve it.
    if (dConf.defaultOptions) {
      dConf.defaultOptions = new FileLockOptionsResolver(dConf.defaultOptions, minimumFileLockOptions).getOptions();
    }
    FileLock.#config = { ...FileLock.getConfig(), ...dConf };

    // Clear chache
    FileLock.clearCache();

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

    // logger
    FileLock.#logger = FileLock._resolveLogger(FileLock.#config);

  }

  /** Reset current configurations. */
  public static resetConfig(): void {
    FileLock.setConfig(FileLock.getDefaultConfig());
  }

  /** Get current configurations. */
  public static getConfig(): Required<FileLockConfig> {
    return FileLock.#copyConfig(FileLock.#config);// || FileLock.getDefaultConfig());
  }

  /** Get default `Config`. */
  public static getDefaultConfig(): Required<FileLockConfig> {
    return FileLock.#copyConfig(defaultFileLockConfig);
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

  /** Clear `lock` instance cache. */
  public static clearCache() {
    const cache = FileLock._getCache();
    if (cache) cache.clear();
  }

  /**
   * @internal
   * 終了時処理。
   * Windows版では、強制終了(process.kill())からは呼び出されることは無いが、本実装は残しておく。
   * @param code 
   * @param signal 
   */
  public static onExit(code: number | null | undefined, signal: NodeJS.Signals | null) {
    FileLock.#logger.trace("Exited by", { code, signal });
    
    FileLock.#cache?.forEach( lock => {
      lock.#onExit(code, signal);
    });
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
        // fs.statSync()は、例外のみ投げるので、Errorに型キャストする
        const e = err as Error;
        const code = 'code' in e && String(e.code);
        if (code === 'ENOENT') return false;
        throw new LockDirectoryStatFailed(e.message, { path: name, props: { fsErrCode: code } } );
      }
      
      if (stat.isDirectory()) {
        return true
      }
      else {
        throw new FileLockError(`'${name}' is not a directory.`, { code: 'ENOTDIR' });
      }
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
      "Failed to create the lock information directory." +
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
   * Whether the instance corresponding to `key` is cached. 
   * @param key   Lock key. 
   * @param lock  Lock instance. 
   */
  static #setCache(key: string, lock: FileLock): void  {
    const cache = FileLock._getCache();
    if (cache) cache.set(key, lock);
  }

  /**
   * @internal
   * Copy config. 
   */
  static #copyConfig<T extends FileLockConfig>(config: T): T {
    const ret = { ...config };
    if (config.defaultOptions) ret.defaultOptions = { ...config.defaultOptions };
    // If specified undefined, delete it.
    for (let key in ret) {
      if (ret[key] === undefined) delete ret[key];
    }
    return ret;
  }


  /** 
   * Instance fields.
   */

  /**
   * @internal
   * Heartbeat timer id 
   */
  #heartbeatTimer?: NodeJS.Timeout | null = null;

  /**
   * @internal
   * Whether or not it is released
   */
  #released: boolean = true;


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

  /**
   * @internal
   * Increment lock counter.
   * @param options 
   */
  protected override async _incReantryCount(options: AllOptions): Promise<void> {
    const meta = this.#getInfo(options);
    options._ownerId =  options._ownerId || meta.ownerId;
    meta.counter = meta.counter;
    meta.counter++;
    return await this.#updateInfo(options, meta);
  }

  /**
   * @internal
   * Decrement lock counter.
   * And, when the counter becomes '0', release lock.
   * @param options 
   */
  protected override async _decReantryCount(options: AllOptions): Promise<void> {
    let meta;
    try {
      meta = this.#getInfo(options);
      if (options._ownerId === meta.ownerId && meta.counter > 0) {
        meta.counter--;
        await this.#updateInfo(options, meta);
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
  }

  /**
   * @internal
   * Make advance preparations.
   * @param options Options
   */
  protected override _prepare(options: AllOptions): void {
    super._prepare(options);
    const dirPath     = FileLock._getLockDirPath();
    const fileDir     = path.join(dirPath, this._key);
    options._filePath     = path.join(fileDir, 'meta.json');
    options._contextId    = options._filePath;  // Use the file path as the context ID 
                                                // to avoid issues caused by changes 
                                                // to the lock directory configuration.
    //const historyName = 'history_' + String(process.pid) + '.json';
    const historyName = 'history.json';
    options._historyFile = path.join(dirPath, historyName);
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
    REQUIRE_DEBUG(FileLockOptionsResolver.isRequiredOptions(userOpts, FileLock.getDefaultOptions()), 
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
    while (!(await this.#tryLock(options))) {
      if (Date.now() >= timeoutTime) {
        throw new AlreadyLocked('', {key: this._key, props: { file: options._filePath } });
      }
      await sleepAsync(pollIntervalMs);
    }
    this._logger.trace('Acquired the lock.')
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
   * @internal
   * Create the lock information file.
   * @param options Options.
   */
  async #createFile(options: AllOptions): Promise<boolean> {
    const dir = path.dirname(options._filePath);

    REQUIRE_DEBUG(fs.existsSync(dir), 
      'The lock key directory has not been created.',
      FileLockError, { code: 'EFILELOCK', eProps: { name: dir } });
    // There is a possibility of a conflict caused by another process. 
    // Therefore, it is determined that locking is not possible.
    if (REQUIRE(
        fs.existsSync(options._filePath) === false,
        'The lock information file already exists. ' +
        'There is a possibility of a conflict caused by another process. ' +
        'Therefore, it is determined that locking is not possible.',
        null
    ) === false) return false;

    try {
      // Create the lock information file.
      await this.#updateInfo(
        options,
        {
          ownerId: options._ownerId = crypto.randomUUID(),
          expirationTime: Date.now() + options.ttlMs,
          heartbeatTimeoutMs: options.heartbeatTimeoutMs,
          lastHeartbeatAt: Date.now(),
          counter: 1
        },
      );
    }
    catch (err) {
      this.#accessInfo(dir, () => fs.rmSync(dir, { recursive: true }), options, "Failed remove the lock informaton file.");
      throw err;
    }

    return true;
  }

  #isDirExpired(dirPath: string, options: AllOptions): boolean {
    const stat = this.#accessInfo(
      dirPath,
      (): fs.Stats => {
        return fs.statSync(dirPath);
      },
      options,
      "Expiration check for orphaned lock key directory."
    );

    const now = Date.now();
    return stat.mtimeMs + (FileLock.#fileDirExpirationMs) <= now;
  }

  /**
   * Attempt to acquire the lock; that is, create the lock information file.
   * @param options Options
   * @returns `true` if acquired lock. 
   */
  async #tryLock(options: AllOptions): Promise<boolean> {
    if (this.#released === false) return false;

    // Check lockable, and if lockable, create lock key directry
    if (this.#isLockable(options) === false) return false;

    // Create the lock information file. 
    if (await this.#createFile(options) === false) {
      // もう、ディレクトリを作る意味がなくなったけれど、、、一応今はちゃんと、、
      fs.rmdirSync(path.dirname(options._filePath));
      return false;
    }
    // Start the heartbeat.
    this.#startHeartbeat(options);

    this.#released = false;

    return true; // Completed lock.
  }

  /**
   * @internal
   * Check lockable.
   * @param options 
   * @returns 
   */
  #isLockable(options: AllOptions): boolean {
    const dir = path.dirname(options._filePath);
    return this.#accessInfo(
      dir, 
      (): boolean => {
        let ret = false;
        try {
          if (fs.existsSync(dir) === false) return ret = true; // Locking is possible because the lock key directory does not exist.

          const meta = this.#getInfoIfExists(options);
          if (meta) {
            if (this.#isLockExpired(meta) === false) return ret = false; // This lock is alive.
          } 
          else { // Found a directory that does not contain lock information.
            if (this.#isDirExpired(dir, options) === false) return ret = false;
          }

          // Delete stale information.
          this.#removeFile(meta, options, true);
          return ret = true;
        }
        finally {
          if (ret === true) {
            try {
              this.#accessInfo(
                dir,
                (): void => {
                  fs.mkdirSync(dir/*, { recursive: true }*/);
                },
                options,
                "Failed to create the lock key directory."
              );
            }
            catch (err) {
              // mkdirSyncにエラーを発生させたテストが必要！！
              return false;
            }
          }
        }
      },
      options,
      "Failed to verify whether locking is possible."
    );
  }

  /**
   * @internal
   * Whether the lock has expired.
   * @param options 
   */
  #isLockExpired(meta: FileLockMeta): boolean {
    this._logger.trace("Lock file contents in isLockExpired():", meta);
    const expired = meta.expirationTime <= Date.now();
    const dead = meta.lastHeartbeatAt + meta.heartbeatTimeoutMs <= Date.now();
    this._logger.trace("expired:", expired, "dead:", dead);
    return expired && dead;
  }

  /**
   * @internal
   * Start heartbeat.
   * @param options Options.
   */
  async #startHeartbeat(options: AllOptions): Promise<void> {
    REQUIRE_DEBUG(this.#heartbeatTimer === null, 
      'Heartbeat multiple startup error. Possible bug.', 
      FileLockError, { code: 'EFILELOCK', props: { options } });

    this._logger.trace(`start heartbeat at ${DateFormatter.format(new Date())}`);

    this.#heartbeatTimer = setInterval(
      async () => {
        try {
          await this.#updateHeartbeat(options);
        }
        catch (err) {
          this._logger.trace(`heartbeat update error at ${DateFormatter.format(new Date())}: ${err}`);
          this.#stopHeartbeat();
          this._onError(err, 'updateHeartbeat', options);
          // To maintain the lock, the heartbeat is not stopped here.
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
    if (this.#heartbeatTimer) {
      this._logger.trace(`stop heartbeat at ${DateFormatter.format(new Date())}`);
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  /**
   * @internal
   * Update heartbeat.
   */
  async #updateHeartbeat(options: AllOptions): Promise<void> {
    const meta = this.#getInfo(options);
    meta.lastHeartbeatAt = Date.now();
    await this.#updateInfo(options, meta);
    this._logger.trace(`update heartbeat at ${DateFormatter.format(new Date(meta.lastHeartbeatAt))}`);
    return;
  }

  /**
   * @internal
   * Remove the lock information file.
   * @param options 
   * @param errMsg 
   */
  #removeFile(meta: FileLockMeta | null, options: AllOptions, force: boolean = false): void {
    meta = meta || this.#getInfoIfExists(options);

    if (force !== true && meta && meta.ownerId !== options._ownerId) return; // It's compromised, so do not remove it.

    // Remove the entire lock key directory.
    const dir = path.dirname(options._filePath)
    return fs.existsSync(dir) && this.#accessInfo(
      dir,
      () => fs.rmSync(dir, { recursive: true, force: true }),
      options,
      `Couldn't remove the lock information file.`
    );
  };

  /**
   * @internal
   * Final unlock processing.
   * @param options Options.
   */
  #actuallyRelease(options: AllOptions) {
    this.#removeFile(null, options);
    this.#stopHeartbeat()
    options._ownerId = null;
    //this.ownerId = null;
    this.#released = true;
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
    let retries = (options.retriesOnIOErr/* || FileLock.#defaultRetriesOnIOErr*/) + 1;
    const retryIntervalMs = options.retryIntervalMs;// || FileLock.#defaultRetryIntervalMs;
    while (retries >= 0) {
      try {
        return methodCb();
      }
      catch (err) {
        if (err instanceof LockError) throw err;
        this._logger.fatal('IO error occuered.', err);
        if (retries--) {
          sleepSync(retryIntervalMs);
          continue;
        }
        let detailMsg: string = '', code: string = 'EFILELOCK';
        // Avoid `if` statements to address coverage issues.
        err instanceof Error && 
        (detailMsg = `(${err.message})`) && 
        (code = ('code' in err && err.code) as string);

        throw new FileLockError(`${errMsg}${detailMsg}`, {code, props: { file: name, cause: err } });
      }
    }
  }

  /**
   * @internal
   * Get the lock information.
   * 本関数は、正しいロック情報が取れた時だけそれをそのまま返す（オーナーチェックは行わない）
   * @param options Options.
   * @returns null if not exist, or the contents as object.
   */
  #getInfoIfExists(options: AllOptions): FileLockMeta | null {
    if (!fs.existsSync(options._filePath)) return null;
    try {
      return this.#getInfo(options, false);
    }
    catch (err) {
      return null;
    }
  }

  /**
   * @internal
   * Get the lock information.
   * 本関数は、正当なロック情報ファイルがあることを前提としている。
   * そのため、存在しない、あるいは、壊れている、あるいは、オーナーが異なるなどすれば、エラー（例外）を投げる。
   * オーナーチェックをするか否かは引数で制御可能。
   * @param  options          Options.
   * @returns Lock information object.
   */
  #getInfo(options: AllOptions, checkOwner: boolean = true): FileLockMeta {
    if (!fs.existsSync(options._filePath)) {
      throw new LockCompromised('The lock information file does not exist.', {key: this._key, props: { file: options._filePath } });
    }

    const contents = this.#accessInfo(
      options._filePath,
      () => fs.readFileSync(options._filePath, 'utf8'), 
      options, 
      `Couldn't read the lock information file.`
    );

    let meta: FileLockMeta;
    try {
      meta = JSON.parse(contents);
    }
    catch (err) {
      throw new LockCompromised(
        `Couldn't parse the lock information file, it is probably broken.`,
        {key: this._key, props: { file: options._filePath, contents, key: this._key, optionsOwnerId: options._ownerId } });
    }

    if(checkOwner === true && options._ownerId && options._ownerId !== meta.ownerId) {
      const err = new LockCompromised(
        'The lock information file was overwritten by another lock.',
        {key: this._key, props: { file: options._filePath, key: this._key, optionsOwnerId: options._ownerId, lockFileOwnerId: meta.ownerId } });
      throw err;
    }

    // Check contents.
    const check = (key: keyof FileLockMeta, type: string | ((v: unknown) => boolean), optional: boolean = false) => {
      // キーが存在し、かつ、型チェック成功なら真
      if (key in meta) {
        if (
          (typeof type === 'string' &&  typeof meta[key] === type) ||
          (typeof type === 'function' && type(meta[key])         )
        ) return true;
      }
      // さもなくば、オプショナルなら真
      else if (optional) return true;
   
      // 条件未達のためエラー
      throw new LockCompromised(`The lock information format is invalid(typeof '${key}' is invalid).`,
        {key: this._key, props: { metaName: key, metaValue: meta[key], file: options._filePath } });
    };

    check("ownerId",             "string"); 
    check("processId",           "number", true); 
    check("parentProcessId",     "number", true); 
    check("processArgv",         
      (v) => Array.isArray(v) && v.every(val => typeof val === 'string'),
      true
    ); 
    check("expirationTime",      "number");
    check("heartbeatTimeoutMs",  "number");
    check("lastHeartbeatAt",     "number");
    check("counter",             "number");

    return meta;
  }

  /**
   * @internal
   * Update the lock information.
   * @param options   Options.
   * @param meta      Lock information.
   * @param withLock  ロックするか否か。。。たぶん、今後不要！
   */
  async #updateInfo(options: AllOptions, meta: FileLockMeta): Promise<void> {
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

    this.#accessInfo(
      options._filePath,
      () => fs.writeFileSync(options._filePath, JSON.stringify(meta)),
      options,
      `Couldn't update the lock information file.`
    );

    if (FileLock.getConfig().history === true || this.#isDebug() === true) {
      this.#addHistory(meta, options);
    }

    return;
  }

  //#history: Record<string, { meta: FileLockMeta, options: AllOptions }> = {};

  /**
   * @internal
   * Adds the lock information to the history.
   * @param meta 
   * @param options 
   */
  /*async */#addHistory(meta: FileLockMeta, options: AllOptions/*, force: boolean = true*/): void { //Promise<void> {
    //  履歴出力のためのロック情報は出力しない
    //if (options._historyInLocked) return;

    const maxEntries = FileLock.getConfig().maxHistoryEntries;
    const dateTimeStr = DateFormatter.format(new Date()); // 例：2026/09/01 12:42:37.915

    //this.#history[dateTimeStr] = { meta, options };

    const _add = () => {
      const historyFile = options._historyFile;
      const contents = this.#accessInfo(
        historyFile, 
        () => fs.existsSync(historyFile) ? fs.readFileSync(historyFile, 'utf8') : null,
        options,
        "Couldn't read the history file."
      );

      let history: Record<string, { meta: FileLockMeta, options: AllOptions }> = {};
      try {
        history = contents ? JSON.parse(contents) : {};
      }
      catch (err) {
        throw new FileLockError('Failed to parse the history file.',
          { code: 'EHISTORY', props:{ name: historyFile, cause: err } })
      }

      //Object.assign(history, this.#history);
      history[dateTimeStr] = { meta, options };

      // 最大数へ調整する
      const keys = Object.keys(history);
      for ( let i = 0; i < keys.length - maxEntries; i++) {
        delete history[keys[i]];
      }

      //  出力
      this.#accessInfo(
        historyFile, 
        () => fs.writeFileSync(historyFile, JSON.stringify(history, null , "  ")),
        options,
        "Couldn't update the history file."
      );
    };

    _add();
    /*
    // 最大数の1/10たまったら出力。または、強制出力。
    //if (Object.keys(this.#history).length >= maxEntries / 10 || force) {
      try {
        const opts: FileLockRequiredOptions = Object.assign(FileLock.getDefaultOptions(), { _historyInLocked: true, timeoutMs: 1000 });
        await FileLock.withLock('history', _add, opts);
      }
      catch (err) {
        this._logger.error(err);
        if (err instanceof FileLockError && err.code === 'EHISTORY')throw err;
        // それ以外は無視しておく
      }
    }
    */
    return;
  }

  #isDebug(): boolean {
    return FileLock.#config._debug;
  }

  /**
   * @internal
   * 終了時処理。
   * Windows版では、強制終了(process.kill())からは呼び出されることは無いが、本実装は残しておく。
   */
  #onExit(code: number | null | undefined, signal: NodeJS.Signals | null): void {
    this._onExit(code, signal);
  }

}

// Initialize
FileLock.initialize();

/**
 * 終了（通常時およびkill()等による強制時）処理を登録。
 * Windows版では、強制終了(kill())からは呼び出されることは無いが、本実装は残しておく。
 * @param code 
 * @param signal 
 * @note 登録された終了関数は、vitestでは、実行されない問題があり、これがv5.xで対応している模様。
 * このため、カバレッジ100％達成は出来ていないが、とりあえず放置する。2026/9/13
 */
onExit((code, signal) => FileLock.onExit(code, signal));
