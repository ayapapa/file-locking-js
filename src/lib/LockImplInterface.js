(async () => {
  const isGas = typeof process === "undefined" || !process.versions || !process.versions.node;

  /**
   * 排他制御（ロック）実装のインターフェイス。
   */
  class LockImplInterface {
    /**
     * 指定したキーに対するロックを取得し、
     * 関数 onLockFn を排他制御下で実行し、ロック解除後にonLockFn の戻り値で解決される Promise を返す。
     *
     * @param {string}  key キー。
     * @param {Function}  onLockFn ロック取得後に実行する処理
     * @param {{ timeoutSec: number }} [options] タイムアウトなどのオプション（単位: 秒）
     *  - timeoutSec: ロック取得のタイムアウト時間。省略時はコンストラクタで指定された値を使用。
     * @return {Promise<*>} onLockFn の戻り値で解決される Promise
     * @abstract
     */
    async withLock(key, onLockFn, options = {}) {
      throw new Error('本関数は継承クラスで実装しなければならない');
    }

    /**
     * 指定したキーに対するロックを取得し、
     * 関数 onLockFn を排他制御下で実行し、ロック解除後にonLockFn の戻り値で解決される Promise を返す。
     *
     * @param {string}  key キー。
     * @param {Function}  onLockFn ロック取得後に実行する処理
     * @param {{ timeoutSec: number }} [options] タイムアウトなどのオプション（単位: 秒）
     *  - timeoutSec: ロック取得のタイムアウト時間。省略時はコンストラクタで指定された値を使用。
     * @return {Promise<*>} onLockFn の戻り値で解決される Promise
     * @abstract
     */
    static async withLock(key, onLockFn, options = {}) {
      throw new Error('本関数は継承クラスで実装しなければならない');
    }

    /**
     * ロックインスタンスを取得する。
     * 指定キー毎に排他制御するためのインスタンスを取得。
     * @param {string}  key キー。
     */
    static getLock(key) {
      throw new Error('本関数は継承クラスで実装しなければならない');
    }
  }


  // エクスポート
  if (isGas) {
    globalThis.LockImpl = LockImplInterface;
    globalThis.LockError = LockError;
    globalThis.DeadlockDetected = DeadlockDetected;
  }
  else {
    module.exports = { LockImplInterface, LockError, DeadlockDetected };
  }

})();