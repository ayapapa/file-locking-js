import path from 'node:path';
import fs from 'node:fs';

import { LockImpl, type CallbackOnLock } from "./LockImpl.ts";
//import { type BaseUserOptions } from "./BaseUserOptions";
//import { type BaseOptionsResolver } from "./BaseOptionsResolver";
import { FileLockUserOptions, typedKeys } from './FileLockUserOptions.ts';
import { FileLockUserOptionsResolver } from "./FileLockUserOptionsResolver.ts";
import { FileLockError, LockDirectoryCreationFailed, LockDirectoryStatFailed } from './FileLockErrors.ts';

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
   * Whether to enable caching for FileLockI instances associated with a key.
   * Default is `true`.
   */
  cache?: boolean;

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
  /**
   * Instance fields
   */

  private static readonly defaultConfig: Config = { cache: true, defaultOptions: FileLock.getDefaultOptions()};
  private static config: Config = FileLock.defaultConfig;
  //private static dirPath: string;
  private baseFilePath?: string;
  private filePath?: string;

  /** Lock key */
  private key: string;
  /** Heartbeat timer id */
  private heartbeatTimer?: number;

  /**
   * Keyに紐づけられたインスタスのキャッシュ。
   * キー毎にインスタンスを紐づけて、Mapにキャッシュする。
   * これによりキー識別と、再入ロック検出の実現を可能とする。
   * キャッシュされたインスタンスは、一定の確率で掃除（その時点において、紐づいたロックファイルが無いものは削除）される（予定）。
   */
  private static cache: Map<string, FileLock> = new Map();

  public static setConfig(config: Config): void {
    const dConf = JSON.parse(JSON.stringify(config));
    FileLock.config = { ...FileLock.defaultConfig, ...dConf };
  }

  public static getConfig(): Config {
    // Return copied config.
    return JSON.parse(JSON.stringify(FileLock.config));
  }

  public static getDefaultConfig(): Config {
    return JSON.parse(JSON.stringify(FileLock.defaultConfig));
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
    if (!FileLock.cache.has(key)) {
      FileLock.cache.set(key, new FileLock(key));
    }
    return (FileLock.cache.get(key))?.withLock(onLockFn, rOpt);
  }

  /**
   * 
   * @returns デフォルトオプションを取得する
   */
  public static getDefaultOptions() {
    return FileLockUserOptionsResolver.getDefaultOptions();
  }

  public static removeCache() {
    this.cache.clear();
  }

  /**
   * Get a directory path for storing files containing lock information.
   * If it has been specified, use this as the top priority.
   * The directory is determined based on the following order of priority:<br>
   *  1. Specified via an `Config` (user's explicit intent)
   *  2. Specified via an environment variable, `'AYPP_FILELOCK_DIR'`, (system administrator or CI/CD configuration)
   *  3. `process.cwd()` (current working directory at runtime)
   *  4. `__dirname` (location of this script)
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
      'process.env["AYPP_FILELOCK_DIR"]': process.env["AYPP_FILELOCK_DIR"],
      'process.cwd()': path.join(process.cwd(), '.lock'),
      '__dirname': path.join(__dirname, '.lock')
    };
    const isSpecified = (i: number) => i < 2;
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


  private async withLock(onLockFn: CallbackOnLock, options: FileLockUserOptions) {
    // ロック情報pathはスタティックインスタンスから取得。などなど、、、、、
    // 基本的に、ロックディレクトリはスタティック設定で決まる！！　なので、ロックファイルも、スタティックに来まる！
    // ★★★★これ、コメントに記載すべき★★★★　その代わり、設定（ロックディレクトリ）変更後は、たとえ同キーだとしても、「変更前の同キーと排他制御できない」ことが、注意事項。
    const  dirPath      = FileLock.getLockDirPath();
    this.baseFilePath = path.join(dirPath, this.key);
    this.filePath     = this.baseFilePath + '.json';
    

   return "test_001"; // 一時的にテスト用として
  }

}
