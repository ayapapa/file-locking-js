import path from 'node:path';
import fs from 'node:fs';

import { LRUCache } from 'lru-cache';
import { Contracts } from '@ayapapa-npm/contracts-js';
const { REQUIRE, REQUIRE_DEBUG } = Contracts;

import { LockImpl, type CallbackOnLock } from "./LockImpl.ts";
import { FileLockUserOptions, typedKeys, type AllOptions } from './FileLockUserOptions.ts';
import { FileLockUserOptionsResolver } from "./FileLockUserOptionsResolver.ts";
import { FileLockError, LockDirectoryCreationFailed, LockDirectoryStatFailed } from './FileLockErrors.ts';

/**
 * FileLock cofiguration. 
 */
export interface Config {
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
   * If unspecified, null, or negative, there is no upper limit. `0` means `cache` is disabled, even if `cache` is true.
   * Default is `100`.
   */
  cacheMaxNum?: number | null;

  /**
   * User default options used with `withLock()`.
   * Default is 'FileLock.getDefaultOptions()'. 
   */
  defaultOptions?: FileLockUserOptions;
}

/**
* File locking. 
* Acquires a lock by creating a file derived from the specified key, executes the provided callback, and then releases the lock (by deleting the created file). 
* While the file exists, no other lock can be acquired for the same key. 
* Settings such as `timeoutMs` allow for waiting until an unreleased lock is freed. 
*/
export class FileLock extends LockImpl {
 
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
  private static cache: LRUCache<string, FileLock>;

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
    FileLock.config.cache = FileLock.config.cacheMaxNum === 0 ? false: FileLock.config.cache

    // Clear chache
    if (FileLock.cache) this.cache.clear();

    // If cache is enabled, (Re)create cache.
    if (FileLock.config.cache) {
      const opts/*: LRUCache.Options<string, FileLock, unknown>*/ = {} as any;
      if (FileLock.config.cacheMaxNum > 0) opts.max = FileLock.config.cacheMaxNum;
      opts.ttl = 50000;
      this.cache = new LRUCache<string, FileLock>(opts);
    }
    // or set null to chache.
    else this.cache = null;
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

  private static copyConfig(config: Config): Config {
    const ret = { ...config };
    if (config.defaultOptions) ret.defaultOptions = { ...config.defaultOptions };
    return ret;
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
    this.cache.clear();
  }

  private static hasCache(key: string) {
    return FileLock.cache && FileLock.cache.has(key);
  }

  private static setCache(key: string, lock: FileLock) {
    if (FileLock.cache) FileLock.cache.set(key, lock);
  }

  private static getLock(key: string) {
    if (FileLock.hasCache(key)) return FileLock.cache.get(key);

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
      catch (err) {
        if (err.code === 'ENOENT') return false;
        throw new LockDirectoryStatFailed(err.message, { path: name, props: { fsErrorCode: err.code } } );
      }
    }
    const mkdir = (name: string): void => {
      try {
        fs.mkdirSync(name,  { recursive: true });
      }
      catch (err) {
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

  /** Instance fields. */

  /** File path for storing lock information (without extension) */
  private baseFilePath?: string;

  /** File path for storing lock information (with extension) */
  private filePath?: string;

  /** Lock key */
  private key: string;

  /** Heartbeat timer id */
  private heartbeatTimer?: number;

  /** Instance methods. */

  /**
   * Constructor.
   * @param {string}  key  
   */
  constructor(key: string) {
    super();
    // ★★★★★　dirPathは、ここで、きめるのは、ダメ。withLockのたびに、ディレクトリを確認しないと、途中の設定の変更を確認できない！！！！★★★★★
    // だとすると、パスは、インスタンスプロパティではダメなのかな？？？　だって、インスタンスで覚えちゃうからね。
    // ★★なので、都度、決めるしかなくなるね！！！って、本当？？？　ちゃんと、設計の見直しを考えよう！！！★★
    // となると、以下の、パス関連は、インスタンスではなく、都度、作る感じだな！！！
    this.key = key;
    /*
    this.dirPath      = FileLock.getLockDirPath();
    this.baseFilePath = path.join(this.dirPath, this.key);
    this.filePath     = this.baseFilePath + '.json';
    */
  }

  private prepare(): void {
    if (FileLock.initialized !== true) FileLock.initialize(); // 念のため
    const  dirPath    = FileLock.getLockDirPath();
    this.baseFilePath = path.join(dirPath, this.key);
    this.filePath     = this.baseFilePath + '.json';
  }

  private async withLock(onLockFn: CallbackOnLock, options: FileLockUserOptions) {
    REQUIRE_DEBUG(
      (options as AllOptions).resolved, 
      "オプションが不完全です（デバッグ用エラー）。", 
      FileLockError, 
      { code: 'EINVALIDOPTIONS', props: options }
    );
    this.prepare();

    // いよいよロック関数を呼ぶ

    return "test_001"; // 一時的にテスト用として
  }

}

// Initialize
FileLock.initialize();
