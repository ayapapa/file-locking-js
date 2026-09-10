import path from 'node:path';
import fs from 'node:fs';
import { LRUCache } from 'lru-cache';
import { DateFormatter } from '@ayapapa-npm/date-formatter-js';
import { Contracts } from '@ayapapa-npm/contracts-js';
const { REQUIRE, REQUIRE_DEBUG } = Contracts;

import { LockBase, type CallbackOnLock } from "./LockBase.ts";
import { LockError } from "./LockBaseErrors.ts";
import { defaultFileLockOptions, minimumFileLockOptions, type FileLockRequiredOptions, type FileLockOptions } from './FileLockOptions.ts';
import { type FileLockInternalState } from './FileLockInternalState.ts';
import { FileLockOptionsResolver, typedKeys } from "./FileLockOptionsResolver.ts";
import {  AlreadyLocked, FileLockError, InvalidOptions, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed, TTLExceeded } from './FileLockErrors.ts';
import { type AllOptions as AllOptionsT } from './AllOptions.ts';
import { defaultFileLockConfig, type FileLockConfig } from './FileLockConfig.ts';
import { getCallStack, sleepAsync, sleepSync } from './Util.ts'
import { FileLockMeta } from './FileLockMeta.ts'

/** 
 * @ internal
 * All options type.
 */
//type AllOptions_ = AllOptionsT<FileLockOptions, FileLockInternalState>;

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
   * Creates a FileLock instance. <br>
   * @param {string}  key Locking key.
   * @internal
   */
  private constructor(key: string) {
    super(key, FileLock.#config);
  }

  /**
   * @internal
   * Increment lock counter.
   * @param options 
   */
  protected override _incReantryCount(options: AllOptions) {
    const meta = this.#getInfo(options);
    options._ownerId =  options._ownerId || meta.ownerId;
    meta.counter = meta.counter;
    meta.counter++;
    this.#updateInfo(options, meta);
  }

  /**
   * @internal
   * Decrement lock counter.
   * And, when the counter becomes '0', release lock.
   * @param options 
   */
  protected override _decReantryCount(options: AllOptions) {
    let meta;
    try {
      meta = this.#getInfo(options);
      if (options._ownerId === meta.ownerId && meta.counter > 0) {
        meta.counter--;
        this.#updateInfo(options, meta);
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
  }

  /**
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
    options._historyFile = path.join(dirPath, 'history.json');
  }
/*
  #isResolvedOptions(options: AllOptions): boolean {
    const rKeys = //型のキー列挙と、その型へのキャスト（文字列はだめ）　そして、備えているかをチェックする
    return false;
  };
*/
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

    // 指定されたオプションと内部状態を結合したものをオプションとして再構成。
    const options = { ...userOpts } as AllOptions;

    this._prepare(options);

    return super._withLock(
      onLockFn,

      async (cb, opts) => { // `cb` is a callback in the parent class that wraps `onLockFn`.

        await this.#acquire(opts);

        // Create TTL timer
        let ttlTimeoutId: NodeJS.Timeout;
        const ttlMs = opts.ttlMs;// || LockBase._defaultTtlMs;
        const timeoutPr = new Promise((_, reject) => {
          ttlTimeoutId = setTimeout(() => {
            reject(new TTLExceeded(null, { ttlMs, props: { key: this._key, file: opts._filePath } }));
          },
          ttlMs);
        });

        // A race between callback processing and the TTL timer.
        try {
          return await Promise.race([cb(), timeoutPr])
            .finally(() => { // In any case, turn off the timer.
              // Avoid if statements as a measure against coverage issue
              ttlTimeoutId && clearTimeout(ttlTimeoutId);
            }
          );
        }
        catch (err) {
          this._onError(err, 'Callback or Timer in withLock()', opts, 'ECALLBACK');
          throw err;
        }
        finally {
          this.#release(opts);
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
  async #acquire(options: AllOptions): Promise<void> {
    const start = Date.now();
    const timeoutTime = start + (options.timeoutMs/* ?? LockBase._defaultTimeoutMs*/);
    const pollIntervalMs = options.pollIntervalMs;// || FileLock.#defaultPollIntervalMs;
    while (!this.#tryLock(options)) {
      if (Date.now() >= timeoutTime) {
        throw new AlreadyLocked('', {key: this._key, props: { file: options._filePath } });
      }
      await sleepAsync(pollIntervalMs);
    }
  }

  /**
   * ファイル生成。
   * ★★★、、、、proper-filelockの使い道を再検討せよ！　そもそも、これをつかって、最初にロックを試みて、だめなら、待つ！　そのうえで、自前のロック情報の中身をみる。。。ロック中は、このproper-filelockもロックを外さない。
   * つまり、２重ロック厳格さを導入するのである。
   * @param options Options.
   */
  #createFile(options: AllOptions) {
    const ttlMs = options.ttlMs;// || LockBase._defaultTtlMs;
    const heartbeatTimeoutMs = options.heartbeatTimeoutMs/* ?? FileLock.#defaultHeartbeatTimeoutMs*/;
    const ownerId = crypto.randomUUID();

    this.#updateInfo(
      options,
      {
        ownerId: options._ownerId = ownerId,
        /*
        processId: process.pid,
        parentProcessId: process.ppid,
        processArgv: process.argv,
        */
        expirationTime: Date.now() + ttlMs,
        heartbeatTimeoutMs: heartbeatTimeoutMs,
        lastHeartbeatAt: Date.now(),
        counter: 1
      },
    );
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
  #tryLock(options: AllOptions): boolean {
    if (this.#released === false) return false;

    const dir = path.dirname(options._filePath);
    const lockable = this.#accessInfo(
      dir, 
      (): boolean => {
        if (fs.existsSync(dir) === false) return true; // 専用ディレクトリが無いのでロック可能

        const meta = this.#getInfoIfExists(options); // ロック情報ファイルがあるかどうかを確認する。なければ、ロック可能。
        if (meta) {
          if (this.#isLockExpired(meta) === false) return false; // This lock is alive.
        } 
        else { // Found a directory that does not contain lock information.
          if (this.#isDirExpired(dir, options) === false) return false;
        }

        // ゴミを削除する。
        this.#removeFile(meta, options, `Couldn't remove the lock information file because it is expired.`);
        return true;
      },
      options,
      "ほげほげほげ"
    );
    if (lockable === false) return false;

    // 専用ロックディレクトリを作成する。
    this.#accessInfo(
      dir,
      (): void => {
        fs.mkdirSync(dir, { recursive: true });
      },
      options,
      "ほげほげほげほげ"
    );      

    // Create lock information file. 
    this.#createFile(options);

    // Start the heartbeat.
    this.#startHeartbeat(options);

    this.#released = false;

    return true; // Completed lock.
  }

  /**
   * @internal
   * Release lock. 
   * In practice, the counter is decremented, and the lock is released when it reaches zero.
   * @param options Options.
   */
  #release(options: AllOptions): void {
    this._decReantryCount(options);
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
    return expired && dead;
  }

  /**
   * @internal
   * Start heartbeat.
   * @param options Options.
   */
  #startHeartbeat(options: AllOptions): void {
    REQUIRE_DEBUG(this.#heartbeatTimer === null, 
      'Heartbeat multiple startup error. Possible bug.', 
      FileLockError, { code: 'EFILELOCK', props: { options } });

    this._logger.trace(`start heartbeat at ${DateFormatter.format(new Date())}`);

    this.#heartbeatTimer = setInterval(
      async () => {
        //if (this.#released) return this.#stopHeartbeat();
        
        try {
          this.#updateHeartbeat(options);
        }
        catch (err) {
          this._logger.trace(`heartbeat update error at ${DateFormatter.format(new Date())}: ${err}`);
          this.#stopHeartbeat();
          this._onError(err, 'updateHeartbeat', options);
          // To maintain the lock, the heartbeat is not stopped here.
        }

        // Therefore, the lock-released flag is checked even after the update.
        //if (this.#released) return this.#stopHeartbeat();
      },
      options.heartbeatIntervalMs// || FileLock.#defaultHeartbeatIntervalMs
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
  #updateHeartbeat(options: AllOptions) {
    const meta = this.#getInfo(options);
    meta.lastHeartbeatAt = Date.now();
    this.#updateInfo(options, meta);
    this._logger.trace(`update heartbeat at ${DateFormatter.format(new Date(meta.lastHeartbeatAt))}`);
  }

  /**
   * @internal
   * Remove the lock information file.
   * @param options 
   * @param errMsg 
   */
  #removeFile(meta: FileLockMeta | null, options: AllOptions, errMsg?: string): void {
    try {
      meta = meta || this.#getInfoIfExists(options);
    }
    catch (err) {
      return;
    }

    if (meta && meta.ownerId !== options._ownerId) return; // It's compromised, so do not remove it.

    // Remove the entire lock key directory.
    const dir = path.dirname(options._filePath)
    return fs.existsSync(dir) && this.#accessInfo(
      dir,
      () => fs.rmSync(dir, { recursive: true, force: true }),
      options,
      errMsg || `Couldn't remove the lock information file.`
    );
  };

  /**
   * @internal
   * Final unlock processing.
   * @param options Options.
   */
  #actuallyRelease(options: AllOptions) {
    //if (options.release) options.release();
    this.#removeFile(null, options);

    this.#stopHeartbeat()

    //pLockfile.unlockSync(options._filePath);

    //delete options.release;
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

        throw new FileLockError(`${errMsg}${detailMsg}`, {code, props: { file: name } });
      }
    }
  }

  /**
   * @internal
   * Get the lock information file's contents as object.
   * @param options Options.
   * @returns null if not exist, or the contents as object.
   */
  #getInfoIfExists(options: AllOptions): FileLockMeta | null {
    if (!fs.existsSync(options._filePath)) {
      return null;
    }
     return this.#getInfo(options);
  }

  /**
   * @internal
   * Get the lock information.
   * 本関数は、ロック情報ファイルがあることを前提としている。そのため、無ければ、故意に削除されたと判断しエラー（例外）を投げる。
   * @param  options          Options.
   * @returns Lock information object.
   */
  #getInfo(options: AllOptions): FileLockMeta {
    if (!fs.existsSync(options._filePath)) {
      throw new LockCompromised('The lock information file does not exist.', {key: this._key, props: { file: options._filePath } });
    }

    const contents = this.#accessInfo(
      options._filePath,
      () => fs.readFileSync(options._filePath), 
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
        {key: this._key, props: { file: options._filePath, key: this._key, optionsOwnerId: options._ownerId } });
    }

    if(options._ownerId && options._ownerId !== meta.ownerId) {
      const err = new LockCompromised(
        'The lock information file was overwritten by another lock.',
        {key: this._key, props: { file: options._filePath, key: this._key, optionsOwnerId: options._ownerId, lockFileOwnerId: meta.ownerId } });
      this._logger.error(err);
      throw err;
    }

    // Check contents.
    const check = (key: keyof FileLockMeta, type: string | ((v: unknown) => boolean), optional: boolean = false) => {
      // キーが存在するなら型チェック成功なら真
      if (key in meta) {
        if (
          (typeof type === 'string' &&  typeof meta[key] === type) ||
          (typeof type === 'function' && type(meta[key])         )
        ) return true;
      }
      // さもなくば、オプショナルなら真
      if (optional) return true;
   
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
  #updateInfo(options: AllOptions, meta: FileLockMeta) {
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
  }


  /**
   * @internal
   * Adds the lock information to the history.
   * @param meta 
   * @param options 
   */
  #addHistory(meta: FileLockMeta, options: AllOptions): void {
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

    const maxEntries = FileLock.getConfig().maxHistoryEntries;
    const dateTimeStr = DateFormatter.format(new Date()); // 例：2026/09/01 12:42:37.915
    history[dateTimeStr] = { meta, options };
    const keys = Object.keys(history);
    for ( let i = 0; i < keys.length - maxEntries; i++) {
      delete history[keys[i]];
    }

    this.#accessInfo(
      historyFile, 
      () => fs.writeFileSync(historyFile, JSON.stringify(history, null , "  ")),
      options,
      "Couldn't update the history file."
    );
  }

  #isDebug(): boolean {
    return FileLock.#config._debug;
  }
}

// Initialize
FileLock.initialize();
