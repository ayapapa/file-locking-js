import path from 'node:path';
import fs from 'node:fs';

import plockfile from 'proper-lockfile';
// withLock定義
const lockfile = {
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

import { LockBase, type CallbackOnLock, type Config as BaseConfig, type LogProvider } from "./LockBase.ts";
import { FileLockUserOptions } from './FileLockUserOptions.ts';
import { type FileLockInternalState } from './FileLockInternalState.ts';
import { FileLockUserOptionsResolver, typedKeys } from "./FileLockUserOptionsResolver.ts";
import {  AlreadyLocked, CallStack, FileLockError, LockCompromised, LockDirectoryCreationFailed, LockDirectoryStatFailed, TTLExceeded } from './FileLockErrors.ts';
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
   *  2. Specified via an environment variable, `'AYPP_FILELOCK_DIR'`, (system administrator or CI/CD configuration)
   *  3. `process.cwd()` (current working directory at runtime)
   *  4. `__dirname` (location of this script)
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
   * Default is 'FileLock.getDefaultOptions()'. 
   */
  defaultOptions?: FileLockUserOptions;
}

interface LockMetaData {
  ownerId: string
  expirationTime: number,
  heartbeatTimeoutMs: number,
  lastHeartbeatAt: number,
  counter: number
}

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sleepSync(ms: number) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, ms);
}

/**
* File locking. 
* Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
* While the file exists, no other lock can be acquired for the same key. 
* Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed. 
*/
export class FileLock extends LockBase<FileLockUserOptions, FileLockInternalState> {
 
  /** Static fields */

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

  /** Static methods */

  /** 初期化。必ず一度は呼ばれなければならない。 */
  public static initialize() {
    FileLock.resetConfig();
    FileLock.initialized = true;
  }

  /**
   * 各種設定を行う。
   * 同時に、キャッシュはクリアされる。
   * @param config 
   */
  public static setConfig(config: Config): void {
    const dConf = FileLock.copyConfig(config);
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

  public static resetConfig(): void {
    FileLock.setConfig(FileLock.getDefaultConfig());
  }

  public static getConfig(): Config {
    return FileLock.copyConfig(FileLock.config);
  }

  public static getDefaultConfig(): Config {
    return FileLock.copyConfig(FileLock.defaultConfig);
  }

  /**
   * Acquires a lock for the specified key,
   * executes the function `onLockFn` under exclusive control, and returns a Promise that resolves with the return value of `onLockFn` after the lock is released. 
   *
   * @param {string}  key
   * @param {CallbackOnLock}  onLockFn ロック取得後に実行する処理
   * @param {UserOptions} [options] オプション
   * @return {Promise<*>} onLockFn の戻り値で解決される Promise
   * @abstract
   */
  public static async withLock(key: string, onLockFn: CallbackOnLock, options: FileLockUserOptions  = {}) {
    REQUIRE(Boolean(key), 'Must specify `key`.', FileLockError, { code: 'EINVAL' });
    const rOpt = new FileLockUserOptionsResolver(options, FileLock.config?.defaultOptions).getOptions();
    return FileLock.getLock(key).withLock(onLockFn, rOpt);
  }

  /**
   * Get deault options(`FileLockUserOptions`).
   * @returns Deault options.
   */
  public static getDefaultOptions(): FileLockUserOptions  {
    return FileLockUserOptionsResolver.getDefaultOptions();
  }

  public static clearCache() {
    if (FileLock.cache) FileLock.cache.clear();
  }

  private static hasCache(key: string): boolean {
    return FileLock.cache != null && FileLock.cache.has(key);
  }

  private static setCache(key: string, lock: FileLock) {
    if (FileLock.cache) FileLock.cache.set(key, lock);
  }

  private static getLock(key: string): FileLock {
    if (FileLock.hasCache(key)) {
      return FileLock.cache?.get(key) as FileLock;
    }
    const lock = new FileLock(key);
    FileLock.setCache(key, lock);
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
        // ロックディレクトリアクセス失敗
        throw new LockDirectoryCreationFailed(err.message, { path: name, props: { path: name, fsErrorCode: err.code } });
      }
    }
    const candies = {
      'config.lockDirectory' : FileLock.config.lockDirectory,
      'process.cwd()': path.join(process.cwd(), '.lock'),
    };
    const isSpecified = (i: number) => i === 0;
    // ロックディレクトリ探索開始
    let candidates: string = '';
    const keys = typedKeys(candies);
    for(let i = 0; i < keys.length; i++) {
      const dir = candies[keys[i]];
      // ディレクトリ指定なしなら次
      if (!dir) continue;
      candidates += "\n" + `- ${dir}`;
      try {
        // ディレクトリが存在するなら、それに決定。
        if (existsDir(dir)) return dir;
        // 無ければ作る
        mkdir(dir);
        return dir;
      }
      catch (err) {
        if (isSpecified(i)) throw err;
        continue;
      }
    };
    // ロックディレクトリ生成失敗
    throw new LockDirectoryCreationFailed(
      "Failed to create the lock information storage directory." +
      "\nAttempted to locate and create it in the following order:" +
      candidates,
      { props: { candidates } }
    );
  }

  private static copyConfig(config: Config): Config {
    const ret = { ...config };
    if (config.defaultOptions) ret.defaultOptions = { ...config.defaultOptions };
    return ret;
  }

  /** Instance fields. */

  /** Heartbeat timer id */
  #heartbeatTimer?: NodeJS.Timeout | null;

  #released: boolean = true;

  /** Instance methods. */

  /**
   * Constructor.
   * @param {string}  key  
   */
  private constructor(key: string) {
    super(key, FileLock.config);
  }

  /**
   * 再入ロックカウンターをインクリメント
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
   * 再入ロックカウンターをデクリメントし、カウンターが０になったら、ロックを解放する
   * @param options 
   */
  protected override decReantryCount(options: AllOptions) {
    try {
      const meta = this.#getMeta(options);
      if (options.ownerId === meta.ownerId) {
        if (meta.counter > 0) meta.counter--;
        this.#setMeta(options, meta);
        if (meta.counter === 0) {
          this.#release(options);
        }
      }
    }
    catch (err) {
      this.onError(err, 'getMeta', options);
      // 不正なメタデータファイルのためロックを解放する
      this.#release(options);
      throw err;
    }
  }

  protected override prepare(options: AllOptions): void {
    super.prepare(options);
    if (FileLock.initialized !== true) FileLock.initialize(); // 念のため
    const  dirPath    = FileLock.getLockDirPath();
    const baseFilePath = path.join(dirPath, this.key);
    options.filePath     = baseFilePath + '.json';
  }

  private async withLock(onLockFn: CallbackOnLock, options: AllOptions) {

    REQUIRE_DEBUG(options.resolved, "オプションが不完全です（デバッグ用エラー）。", 
      FileLockError, { code: 'EINVALIDOPTIONS', props: options });

    this.prepare(options);

    return super._withLock(
      onLockFn,
      /*
      (monitor: Monitor) => {
        // ★★★monitor付き、コールバックは、親クラスに閉じ込めたいな！！！！★★★
        return onLockFn(monitor);
      },
      */
      async (cb, opts) => {// cb は、親クラスにてラッピングされたコールバック

        await this.#lock(opts);

        // 処理実行最大時間タイマー
        let ttlTimeoutId: NodeJS.Timeout;
        const timeoutPr = new Promise((_, reject) => {
          ttlTimeoutId = setTimeout(() => {
            reject(new TTLExceeded(null, { ttlMs: opts.ttlMs as any }))
          },
          opts.ttlMs);
        });

        // ロック取得成功、コールバック関数を実行
        try {
          return await Promise.race([cb(), timeoutPr])
            .finally(() => {
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
   * 手前のロックがあればその解除を待った後に、ロックする。
   * 指定待ち時間を超えた場合はエラー（例外）
   * @param options  オプション
   * @returns ロック解放関数
   */
  async #lock(options: AllOptions): Promise<void> {
    return this.#waitPreviousAndLock(options, () => {
      //let release;// = { releaseMeta: () => void };
      // メタファイル作成
      try {
        if (!this.#execLock(options)) return false; // 前段ロックが有効なので、ロックできなかった
      }
      catch (err) {
        throw err;
      }
      // ロック解放関数を返す
      //options.release = release;
      this.#released = false;
      return true;
    });
  }

  /**
   * ロック実行。すなわち、ロック情報格納ファイルを作成する。
   * @param options オプション。
   * @returns ロック取得の場合は解放用関数を、さもなくば、nullを返す
   */
  #execLock(options: AllOptions): boolean {
    // 本インスタンスの解放フラグが経っていないなら、前段ロック中なのでnull
    if (this.#released === false) return false;
    // ファイルを確認し、有効ならnull
    if (fs.existsSync(options.filePath)) {
      if (!this.#isLockExpired(options)) return false;//有効な前段ロックあり
    }
    // ロック獲得可能なためロック情報格納ファイル作成
    const ttlMs: number = options.ttlMs ?? FileLock.getDefaultOptions().ttlMs as any;
    const heartbeatTimeoutMs: number = options.heartbeatTimeoutMs as any
    this.#setMeta(
      options,
      {
        ownerId: options.ownerId = this.ownerId = crypto.randomUUID(),
        expirationTime: Date.now() + ttlMs,
        heartbeatTimeoutMs: heartbeatTimeoutMs,
        lastHeartbeatAt: Date.now(),
        counter: 1
      },
      false
    );
    this.logger.trace('lockMeta: CreatedLockFile', 
      new CallStack({ props:{ key: this.key, optionsId: options.ownerId, instaceId: this.ownerId }
    }));
    // ハートビートタイマー開始
    this.#startHeartbeat(options);
    // 解放関数を返す
    //return () => this.#unlockMeta(options)
    return true;
  }

  /**
   * ロックを解除する
   * @param options オプション。
   */
  #unlock(options: AllOptions): void {
    this.decReantryCount(options);
  }

  /**
   * 前段ロックがある場合はその解除を待った後にロックする
   * @param {UserOptions} options 
   * @param {function} lockFn 
   */
  async #waitPreviousAndLock(options: AllOptions, tryLock: () => boolean): Promise<void> {
    const start = Date.now();
    const timeoutTime = start + (options.timeoutMs as any);
    while (!tryLock()) {
      if (Date.now() >= timeoutTime) {
        throw new AlreadyLocked('', {key: this.key, props: { file: options.filePath } });
      }
      await sleepAsync(options.pollIntervalMs as any);
    }
  }

  /**
   * メタファイルが有効期限切れ
   * @param options 
   */
  #isLockExpired(options: AllOptions): boolean {
    // ★★★　メタ有効期限expirationTime　と ハートビート有効期限をチェック
    // 　options.expiredCheckByを使って判断する
    const meta = this.#getMetaOrNull(options);
    // とりあえず、メタ有効期限（実行開始時間＋最大実行時間）
    const expired = !meta || meta.expirationTime < Date.now();
    const dead = !meta || meta.lastHeartbeatAt + meta.heartbeatTimeoutMs < Date.now();
    return expired && dead;
  }

  /**
   * ハートビートタイマーを開始する
   * @param {UserOptions}
   */
  #startHeartbeat(options: AllOptions) {
    if (this.#heartbeatTimer) return; // 二重起動防止
    this.logger.trace(`start heartbeat at ${DateFormatter.format(new Date())}`);
    this.#heartbeatTimer = setInterval(
      async () => {
        // ロック解放済なら停止
        if (this.#released) return this.#stopHeartbeat();
        try {
          this.#updateHeartbeat(options);
        }
        catch (err) {
          this.logger.trace(`heartbeat update error at ${DateFormatter.format(new Date())}: ${err}`);
          this.onError(err, 'updateHeartbeat', options);
          // ロック処理継続のためここではハートビートを止めることはしない
        }
        // 念のため更新後にもロック解放済フラグをチェック。
        if (this.#released) return this.#stopHeartbeat();
      },
      options.heartbeatIntervalMs);
  }

  /**
   * ハートビートタイマーを停止する
   */
  #stopHeartbeat() {
    if (this.#heartbeatTimer) {
      this.logger.trace(`stop heartbeat at ${DateFormatter.format(new Date())}`);
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  /**
   * ハートビート時間を更新する
   */
  #updateHeartbeat(options: AllOptions) {
    const meta = this.#getMeta(options);
    meta.lastHeartbeatAt = Date.now();
    this.#setMeta(options, meta);
    this.logger.trace(`update heartbeat at ${DateFormatter.format(new Date(meta.lastHeartbeatAt))}`);
  }

  /**
   * メタファイルのロックを解除（ファイル削除）
   * @param options 
   * @param errMsg 
   */
  #unlockMeta(options: AllOptions, errMsg?: string): void {
    let meta;
    try {
      meta = this.#getMetaOrNull(options);
      if (!meta) return;
    }
    catch (err) {
      return;
    }
    if (meta.ownerId !== options.ownerId) return; // 後段に浸食されているので解放しない
    // メタデータファイルを削除する
    return this.#accessMetaWithLock(
      options.filePath,
      (name) => fs.rmSync(name/*,  {recursive: true, force: true}*/),
      options,
      errMsg || `ロックメタファイル削除エラー`
    );
  };

  /**
   * ロックを解除する
   * @param options オプション。
   */
  #release(options: AllOptions) {
    //if (options.release) options.release();
    this.#unlockMeta(options);

    this.#stopHeartbeat()

    //delete options.release;
    options.ownerId = null;
    this.ownerId = null;
    this.#released = true;
  }

  /**
   * ファイルまたはディレクトリ操作
   * @param {string}  name  アクセス対象ファイルまたはディレクトリのパス 
   * @param {((name:string) => (void|string))}  methodCb
   * @param {UserOptions} options 
   * @param {string} [errMsg] 
   */
  #accessMetaWithLock(name: string, methodCb: (name:string) => any, options: AllOptions, errMsg: string | null = null): any {
    let retries = options.retriesOnIOErr as any + 1;
    while (retries >= 0) {
      try {
        // ロックファイルでガードしたうえで操作する
        return lockfile.withLock(
          name, 
          () => methodCb(name),
          {realpath: false/*, retries: options._lockfileRetries?? 5*/} // lockSyncなのでretriesは指定できない（エラー）
        );
      }
      catch (err: any) {
        if (retries--) {
          // クリティカルセクションなので同期スリープを利用
          sleepSync(options.retryIntervalMs as any);
          continue;
        }
        if (err.code === 'ELOCKED') {
          throw new AlreadyLocked('', { key: this.key, props: { file: name } });
        }
        errMsg = errMsg || `ロックメタファイルアクセスエラー`;
        throw new FileLockError(`${errMsg}(${err.message})`, {code: err.code, props: { file: name } });
      }
    }
  }

  #getMetaOrNull(options: AllOptions): LockMetaData | null {
    if (!fs.existsSync(options.filePath)) {
      return null;
    }
     return this.#getMeta(options);
  }
  /**
   * ロックメタ情報を取得する
   * @param  options 
   * @param  errorIfNotExist  trueならロックメタファイルが無い時にLockCompromisedエラー
   * @returns errorIfNotExistがfalseの場合、未ロック（ロックメタファイルが無い）ならnull
   */
  #getMeta(options: AllOptions): LockMetaData {
    if (!fs.existsSync(options.filePath)) {
      throw new LockCompromised('The lock information storage file does not exist.', {key: this.key, props: { file: options.filePath } });
    }
    const contents = this.#accessMetaWithLock(
      options.filePath,
      (name: string) => fs.readFileSync(name), 
      options, 
      `Lock metafile read error.`
    );
    const meta: LockMetaData = contents ? JSON.parse(contents) : {};
    if(options.ownerId && options.ownerId !== meta.ownerId) {
      const err = new LockCompromised(
        'The lock information storage file was overwritten by another lock.',
        {key: this.key, props: { file: options.filePath, key: this.key, optionsId: options.ownerId, instanceId: this.ownerId, lockFileId: meta.ownerId } });
      this.logger.error(err);
      throw err;
    }
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
   * メタデータをセットする
   * @param {UserOptions} options 
   * @param {MetaData}  meta
   * @param {boolean}   withLock
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
          `ロックメタファイル書き込みエラー`
        );
      }
    }
    catch (err: any) {
      if (err instanceof FileLockError === false) {
        err = new FileLockError('ロックメタファイル書き込みエラー', {code: err.code, props: { file: options.filePath } });
      } 
      throw err;
    }
  }

}

// Initialize
FileLock.initialize();

export { LogProvider };