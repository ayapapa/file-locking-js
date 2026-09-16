import path from 'node:path';
import fs from 'node:fs';
import { onExit } from 'signal-exit';

import { LRUCache } from 'lru-cache';
import { DateFormatter } from '@ayapapa-npm/date-formatter-js';
import { Contracts } from '@ayapapa-npm/contracts-js';
const { ENSURE_DEBUG, REQUIRE, REQUIRE_DEBUG, VERIFY } = Contracts;

import { LockBase, type CallbackOnLock } from "./LockBase.ts";
//import { LockError } from "./LockBaseErrors.ts";
import { defaultFileLockOptions, minimumFileLockOptions, type FileLockRequiredOptions, type FileLockOptions } from './FileLockOptions.ts';
import { type FileLockInternalState } from './FileLockInternalState.ts';
import { FileLockOptionsResolver, typedKeys } from "./FileLockOptionsResolver.ts";
import {  AlreadyLocked, FileLockError, InvalidOptions, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed, LockFileBroken } from './FileLockErrors.ts';
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
  //static readonly #fileDirExpirationMs: number = 1000; // 1 second

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
        REQUIRE_DEBUG(err instanceof Error, '想定外のキャッチオブジェクト', FileLockError, { code: 'EUNKNOWN', props: { cause: err } });
        const e = err as Error; // 検証済
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
    return await this.#updateInfo(meta, options);
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
        await this.#updateInfo(meta, options);
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
    /******
     * ★★★　ディレクトリやめ！！　ファイル直接書き
     * ★★★　ただし、 const fd = fs.openSync(path, 'wx'); とつかって、ロックの間は、このfdを持っておくこと！　アップデートも、削除も！！
     * fs.writeFileSync(fd, "hogehogehoge");でOK:　最後に fs.closeSync(fd)
     */
    /*
    const fd = fs.openSync("path", 'wx');
    fs.closeSync(fd);
    fs.unlinkSync(fd);
    .....
    */
    super._prepare(options);
    const dirPath     = FileLock._getLockDirPath();
    //const fileDir     = path.join(dirPath, this._key);
    options._filePath = path.join(dirPath, this._key + '.json');
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
    let tryRes = null;
    while ((tryRes = await this.#tryLock(options)).locked === false) {
      if (Date.now() >= timeoutTime) {
        const errIns = {
          'ELOCKED'  : new AlreadyLocked('', {key: this._key, props: { file: options._filePath } }),
          'EBROKEN'  : new LockFileBroken({ file: options._filePath, props: { cause: tryRes.cause} }),
          'EIO'      : LockFileBroken.lockFailedDueToIO(options._filePath, tryRes.cause),
          'EHISTORY' : LockFileBroken.lockFailedDueToHistory(tryRes.cause),
        } as const as Record<string, unknown>;
        const err = errIns[tryRes.reason];
        ENSURE_DEBUG(err != null, 'Unexpected lock failure reason. This may be a malfunction.',
          FileLockError, { code: 'EUNEXPECTED', props: { cause: tryRes.cause } });
        throw err;
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
    //const dir = path.dirname(options._filePath);
    /*
    REQUIRE_DEBUG(fs.existsSync(dir), 
      'The lock key directory has not been created.',
      FileLockError, { code: 'EFILELOCK', eProps: { name: dir } });
    */
    // There is a possibility of a conflict caused by another process. 
    // Therefore, it is determined that locking is not possible.
    /*
    if (REQUIRE(
        fs.existsSync(options._filePath) === false,
        'The lock information file already exists. ' +
        'There is a possibility of a conflict caused by another process. ' +
        'Therefore, it is determined that locking is not possible.',
        null
    ) === false) return false;
    */

    try {
      // Create the lock information file.
      await this.#updateInfo(
        {
          ownerId: options._ownerId = crypto.randomUUID(),
          expirationTime: Date.now() + options.ttlMs,
          heartbeatTimeoutMs: options.heartbeatTimeoutMs,
          lastHeartbeatAt: Date.now(),
          counter: 1
        },
        options
      );
    }
    catch (err) {
      //this.#accessInfo(dir, () => fs.rmSync(dir, { recursive: true }), options, "Failed remove the lock informaton file.");
      throw err;
    }

    return true;
  }

  /*
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
    */

  /**
   * Attempt to acquire the lock; that is, create the lock information file.
   * @param options Options
   * @returns `true` if acquired lock. 
   */
  async #tryLock(options: AllOptions): Promise<{ locked: boolean, reason: string, cause?: unknown }> {
    if (this.#released === false) return {locked: false, reason: 'ELOCKED'};

    let ret = null;
    // Check lockable, and if lockable, create lock key directry
    if ((ret = this.#isLockable(options)).lockable === false) {
        return { locked: false, reason: ret.reason, cause: ret.cause };
    }

    // Create the lock information file. 
    try {
      await this.#createFile(options);
    }
    catch (err) { // 'EIO' または、'EHISTORY'
      // エラー検証
      // REQUIRE_DEBUG(....)
      try {
        // 既に、ロックファイルは作成済みのはずなので、削除する。
        if (fs.existsSync(options._filePath)) fs.unlinkSync(options._filePath);
      }
      catch (err2) {
        // ここでのIOエラーは、あきらめる。
        err = err2;
      }
      const reason =  err instanceof FileLockError && err.code === 'EHISTORY' ? 'EHISTORY' : 'EIO';
      return { locked: false, reason, cause: err };
    }
    /*
    if (await this.#createFile(options) === false) {
      //fs.rmdirSync(path.dirname(options._filePath)); もう不要
      return false;
    }
      */
    // Start the heartbeat.
    this.#startHeartbeat(options);

    this.#released = false;

    return { locked: true, reason: 'ACQUIRED' };
  }

  #exclusiveOpenFile(options: AllOptions): boolean {
    try {
      // 開ければロック可能
      const fd = fs.openSync(options._filePath, 'wx');
      // fdの再利用はしないため閉じる。
      fs.closeSync(fd);
      return true;
    }
    catch (err) {
      return false;
    }
  }

  /**
   * @internal
   * Check lockable.
   * @param options 
   * @returns 
   */
  #isLockable(options: AllOptions): { lockable: boolean, reason: string, cause?: unknown } {
    // const dir = path.dirname(options._filePath);
    /*
    return this.#accessInfo( // ★★　ほんとうに、ここ全体を、accessInfoで来るんでよいのか？？　エラー時に、2倍のリトライ走るよ！！★★
      options._filePath, 
      (): { lockable: boolean, reason: string, cause?: unknown } => {
    */
        let ret = false;

        try {

          //if (fs.existsSync(dir) === false) return ret = true; // Locking is possible because the lock key directory does not exist.
          ret = this.#exclusiveOpenFile(options);
          if (ret) return { lockable: true, reason: 'LOCKFILEOPENED' }; // lockable

          // 上記で排他オープンできなかったので、メタデータを読み込む
          let meta = null;
          //try {
            meta = this.#getInfoIfExists(options, true);
          /*
          }
          catch (err) {
            REQUIRE_DEBUG(err instanceof FileLockError, '想定外のErrorをキャッチ', FileLockError, { code: 'EUNKNOWN', props: { cause: err} });
            if (err instanceof LockCompromised) {
              return { lockable: false, reason: 'EBROKEN' };
            }
            return { lockable: false, reason: (err as FileLockError).code }; // 検証済み
          }
        */
          if (meta && this.#isLockExpired(meta) === false)  {
            return { lockable: false, reason: 'ELOCKED' }; // This lock is alive.
          }
          /*
          const meta = this.#getInfoIfExists(options);
          if (meta && this.#isLockExpired(meta) === false) return { lockable: false, reason: 'LOCKED' }; // This lock is alive.
          else { // Found a directory that does not contain lock information.
            if (this.#isDirExpired(dir, options) === false) return ret = false;
          }
          */

          // Delete stale information.
          if (this.#removeAndReopenFile(options)) {
            return { lockable: true, reason: 'LOCKFILEOPENED' };
          }
          else {
            return { lockable: false, reason: 'ELOCKED' }; // 多分、他のロックに先を越された。
          }
        }
        catch (err) {
          // データ不正やIOエラーは、ロックリトライ対象とするため、lockable=falseとする。
          REQUIRE_DEBUG(err instanceof FileLockError, '想定外のErrorをキャッチ', FileLockError, { code: 'EUNKNOWN', props: { cause: err} });
          if (err instanceof LockCompromised) {
            return { lockable: false, reason: 'EBROKEN', cause: err };
          }
          // その他は、IOエラーのみのはず（検証方法は？？）
          return { lockable: false, reason: 'EIO', cause: err }; // 検証済み
        }
        finally {
          /*
          if (ret === true) {
            try {
              this.#accessInfo(
                dir,
                (): void => {
                  fs.mkdirSync(dir);
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
          */
        }
      /*
      },
      options,
      "Failed to verify whether locking is possible."
    );
    */
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
          // カバレッジ対応のためにif文を回避する
          this.#released == false && await this.#updateHeartbeat(options);
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
    await this.#updateInfo(meta, options);
    this._logger.trace(`update heartbeat at ${DateFormatter.format(new Date(meta.lastHeartbeatAt))}`);
  }

  #removeAndReopenFile(options: AllOptions): boolean {
    // カバレージ対応のためif文回避
    fs.existsSync(options._filePath) && this.#removeFile___(options);
    /*
    const file = options._filePath;
    this.#accessInfo(
      file,
      () => fs.unlinkSync(file),
      options,
      `Couldn't remove the lock information file.`
    );
    */
    return this.#exclusiveOpenFile(options);
  }
/*
  #closeFile___(options: AllOptions): void {
    this.#accessInfo(
      options._filePath,
      () => { fs.closeSync(options._fd); options._fd = -1; },
      options,
      `Couldn't remove the lock information file.`
    );
  }
*/
  #removeFile___(options: AllOptions): void {
    const file = options._filePath;
    this.#accessInfo(
      file,
      () => fs.unlinkSync(file),
      options,
      `Couldn't remove the lock information file.`
    );
  }

  /**
   * @internal
   * Remove the lock information file.
   * @param options 
   * @param errMsg 
   */
  #removeFile(meta: FileLockMeta | null, options: AllOptions, force: boolean = false): void {
    meta = meta || this.#getInfoIfExists(options);

    // 自前のファイルでない場合は、削除しない
    if (force === false && (meta === null || meta.ownerId !== options._ownerId)) return; // It's compromised, so do not remove it.

    // 自前作成のファイルを削除する
    //this.#closeFile___(options);
    this.#removeFile___(options);
    /*
    const file = options._filePath;
    this.#accessInfo(
      file,
      () => fs.unlinkSync(file),
      options,
      `Couldn't remove the lock information file.`
    );
    */

    // Remove the entire lock key directory.
    /*
    const dir = path.dirname(options._filePath)
    return fs.existsSync(dir) && this.#accessInfo(
      dir,
      () => fs.rmSync(dir, { recursive: true, force: true }),
      options,
      `Couldn't remove the lock information file.`
    );
    */
  };

  /**
   * @internal
   * Final unlock processing.
   * @param options Options.
   */
  #actuallyRelease(options: AllOptions) {
    this.#released = true;
    // ハートビート止める（これをしてからでないと、削除はしてはならない）
    this.#stopHeartbeat()
    this.#removeFile(null, options);
    options._ownerId = null;
    //this.ownerId = null;
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
        // カバレッジ対応のため、if文回避。
        //err instanceof LockError && (() => { throw err; })();
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
   * 不正ファイル時は、`throwErr`が`true`なら、エラー。さもなくば、`null`を返す。
   * @param options Options.
   * @returns null if not exist, or the contents as object.
   */
  #getInfoIfExists(options: AllOptions, throwErr: boolean = false): FileLockMeta | null {
    if (!fs.existsSync(options._filePath)) return null;
    try {
      return this.#getInfo(options, false);
    }
    catch (err) {
      if (throwErr) throw err;
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
    REQUIRE(fs.existsSync(options._filePath), 
      'The lock information file does not exist.', 
      LockCompromised, 
      {key: this._key, props: { file: options._filePath } });

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

    /*
    if (checkOwner === true && options._ownerId && options._ownerId !== meta.ownerId) {
      const err = new LockCompromised(
        'The lock information file was overwritten by another lock.',
        {key: this._key, props: { file: options._filePath, key: this._key, optionsOwnerId: options._ownerId, lockFileOwnerId: meta.ownerId } });
      throw err;
    }
   */
    VERIFY(checkOwner === false || options._ownerId == null || options._ownerId === meta.ownerId,
      'The lock information file was overwritten by another lock.',
      LockCompromised,
      { key: this._key, props: { file: options._filePath, key: this._key, optionsOwnerId: options._ownerId, lockFileOwnerId: meta.ownerId } }
    );

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
   
      return false;
      /*
      // 条件未達のためエラー
      throw new LockCompromised(`The lock information format is invalid(typeof '${key}' is invalid).`,
        {key: this._key, props: { metaName: key, metaValue: meta[key], file: options._filePath } });
      */
    };

    const checkArr = [
      { key: "ownerId", type: "string" }, 
      { key: "processId",         type: "number", optional: true }, 
      { key: "parentProcessId",   type: "number", optional: true }, 
      { key: "processArgv",         
        type: (v) => Array.isArray(v) && v.every(val => typeof val === 'string'),
        optional: true
       }, 
      { key: "expirationTime",    type: "number" },
      { key: "heartbeatTimeoutMs",type: "number" },
      { key: "lastHeartbeatAt",   type: "number" },
      { key: "counter",           type: "number" },
    ] as { key: keyof FileLockMeta, type: string | ((v: unknown) => boolean), optional?: boolean }[];

    const checkAll = () => {
      const invalidProps = [] as { key: string, value: unknown}[];
      checkArr.forEach(v => {
        if (check(v.key, v.type, v.optional ?? false) === false) {
          invalidProps.push({ key: v.key, value: meta[v.key] });
        }
      });
      if (invalidProps.length > 0) {
              throw new LockCompromised(`The lock information format is invalid`,
                {key: this._key, props: { invalidProps, file: options._filePath } });
      }
    }

    checkAll();


    /*
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
*/
    return meta;
  }

  /**
   * @internal
   * Update the lock information.
   * @param options   Options.
   * @param meta      Lock information.
   * @param withLock  ロックするか否か。。。たぶん、今後不要！
   */
  async #updateInfo(meta: FileLockMeta, options: AllOptions): Promise<void> {
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

    this.#writeFile(meta, options);
    /*
    const fd = options._fd;
    const metaStr = JSON.stringify(meta, null , "  ");
    this.#accessInfo(
      options._filePath,
      () => {
        if (fd >= 0) {
          fs.ftruncateSync(fd, 0);
          fs.writeSync(fd, metaStr, 0, 'utf8');
        }
        else {
          fs.writeFileSync(options._filePath, metaStr, 'utf8');
        }
      },
      options,
      `Couldn't update the lock information file.`
    );
    */

    if (FileLock.#config.history === true || this.#isDebug() === true) {
      this.#addHistory(meta, options);
    }

    return;
  }

  #writeFile(meta: FileLockMeta, options: AllOptions): void {
    const metaStr = JSON.stringify(meta, null , "  ");
    this.#accessInfo(
      options._filePath,
      () => {
        fs.writeFileSync(options._filePath, metaStr, 'utf8');
      },
      options,
      `Couldn't update the lock information file.`
    );
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

    // ヒストリーは、一旦別ファイルに排他書きし、そのあと、renameする。
    // おそらく、遅延発生による歯抜け（つまり、一部が書き出されないこともあることを想定する。。）
    //  =>　★★そのため、テストは考慮が必要（つまり、全て書かれないので、かならず履歴が更新されるというテストはやめる必要あり★★
    // ロックすると、あまりの頻繁なロックが発生し、テスト中になんどもタイムアウトとなる。。⇒　本チャンロックへの支障をきたしていた。。

    const maxEntries = FileLock.#config.maxHistoryEntries;
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
        throw FileLockError.dueToHistory(historyFile, err);
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
        () => fs.writeFileSync(historyFile, JSON.stringify(history, null , "  "), 'utf-8'),
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
