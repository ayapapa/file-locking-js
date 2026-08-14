import { LockImpl, type BaseUserOptions, type BaseOptionsResolver, type CallbackOnLock } from "./LockImpl";
import { FileLockUserOptions } from './FileLockUserOptions';
import { FileLockUserOptionsResolver } from "./FileLockUserOptionsResolver";

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

  /** Lock key */
  private key: string = null;

  /** Heartbeat timer id */
  private heartbeatTimer: number = null;

  /**
   * Constructor.
   * @param {string}  key  
   */
  constructor(key: string) {
    super();
    this.key = key;
    /*
    this._filePath = this.constructor._getBasePath(this.#key);
    this._lockFilePath      = this._filePath + '.lock';
    this._lockMetaFilePath  = path.join(this._filePath + '.json');
    */
  }

  private async withLock(onLockFn: CallbackOnLock, options: FileLockUserOptions) {
    // 管理キー生成
    // キー毎のインスタンス管理
    // これによりキー識別と、再入ロック検出の実現を可能とする
    /*
    if (!KeyFileLockMap.has(key)) {
      KeyFileLockMap.set(key, new FileLockImpl(key));
    }
    return KeyFileLockMap.get(key).withLock(onLockFn, options);
    */
   return null;
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
    const optResolver = new FileLockUserOptionsResolver(options);
    // 管理キー生成
    // キー毎のインスタンス管理
    // これによりキー識別と、再入ロック検出の実現を可能とする
    /*
    if (!KeyFileLockMap.has(key)) {
      KeyFileLockMap.set(key, new FileLockImpl(key));
    }
    return KeyFileLockMap.get(key).withLock(onLockFn, options);
    */
   return null;
  }
}