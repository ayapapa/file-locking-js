// 利用モジュールの読み込み
import { AsyncLocalStorage } from 'node:async_hooks';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';
import { AnyMxRecord } from 'node:dns';
import { LockError, DeadlockDetected, TTLExceeded, AlreadyLocked} from './LockErrors.ts';
import { type AllOptions, type BaseUserOptions, type InternalState, type Monitor } from './BaseUserOptions.ts';
import { BaseOptionsResolver } from './BaseOptionsResolver.ts';

const {REQUIRE, VERIFY, REQUIRE_DEBUG} = Contracts;
const logger = new PrettyConsole();

/** Definition of the callback function to be executed after acquiring the lock. */
export type CallbackOnLock = (monitor: Monitor) => any;

/** 再入ロック検出用のコンテキストオブジェクト */
export interface ReentrantContext  {
  /** Set of reentrant context ids */
  heldLocks: Map<string, { monitor: Monitor }>;
}

export type LogProvider = Pick<Console, 'log' | 'trace' | 'debug' | 'info' | 'warn' | 'error' > & {fatal?: (...args: any[]) => void};

export interface Config {
   /**
    * External logger. 
    * Default is `console`.
    */
   logger?: LogProvider;

   /** 
    * The number of stack frames collected in the stack trace of LockError and 
    * its subclasses (DeadlockDetected, TTLExceeded, AlreadyLocked, LockCompromised, FileLockError, etc.).
    * The default value is 10 but may be set to any valid JavaScript number. 
    * If set to a non-number value, or set to a negative number, stack traces will not capture any frames.
    */
   ErrorStackTraceLimit?: number;
 }

/**
 * 排他制御（ロック）実装の基本クラス。
 * AsyncLocalStorage を利用して、リエントラントロック（再入ロック）の回避を行う。
 *
 * 注意: AsyncLocalStorage によるリエントラントロック（再入ロック）の回避は、
 * 同一 Node プロセス内の同じ非同期コンテキストにのみ有効。
 * コンテキスト内にける別プロセス起動先でのロックの再入制御までは行えない。
 * @class LockBase
 */
export class LockBase <T extends BaseUserOptions = BaseUserOptions, I extends InternalState = InternalState>  {

  /** Static fieilds. */

  /**
   * AsyncLocalStorage. 
   * Used for reentrant lock detection.
   * Since the goal is to share reentrancy context information (via `getStore()`) regardless of the specific instance, 
   * it is implemented as a static property to enable sharing across instances.  
   */
  private static als: AsyncLocalStorage<ReentrantContext> = new AsyncLocalStorage<ReentrantContext>();

  /** Static methods */


  /** Instance fieilds. */

  protected logger: LogProvider;

  /** Lock key */
  protected key: string;

  /** Lock owner id. */
  protected ownerId: string = '';

  /** コンテキストID（リエントラントロック検出用） */
  private contextId: string;


  /** Instance methods. */

  /**
   * コンストラクタ。
   */
  protected constructor(key: string, config?: Config) {
    this.key = key;
    this.contextId  = key;// crypto.randomUUID();
    this.logger = config?.logger ?? console;
    if (this.logger === console) {
      this.logger = {...console as LogProvider};
      this.logger.trace = this.logger.debug;
    }
    // 'fatal'が無いケースもあるので、その場合は、'error'を利用する。
    if (!this.logger.fatal) this.logger.fatal = this.logger.error;
  }

  /**
   * デフォルトオプションを取得する
   * @returns {object}
   */
//  public defaultOptions(): BaseUserOptions {
//    return BaseOptionsResolver.getDefaultOptions();
    /*
    return {
      timeoutMs:      5000,   // ロック解除待ち最大時間のデフォルトは5秒
      ttlMs:          10000,  // ロック有効期間(time to live)のデフォルトは10秒
      allowReentry:   false,  // 再入ロック禁止をデフォルトとする
      resolved:       false,
      logger:         console
    };
    */
//  }

  /**
   * ユーザーオプションを検証後、内部用に一部変更・補完した結果を取得する。
   * @param {BaseUserOptions}    opts デフォルトオプション
   * @param {function}      [optsCls]     オプションクラス
   * @returns {BaseUserOptions}
   */
//  private resolveOptions(opts: T, optsCls = BaseOptionsResolver): AllOptions<T, I> {
//    if (opts.resolved) return opts; // すでに解決済
//    const resolved = new optsCls(opts)
//    REQUIRE_DEBUG(resolved instanceof BaseOptionsResolver, "オプションクラス不正", LockError, {code: 'EINVAL'});
//    resolved.resolveOptions();
//    return resolved.getOptions();
//  }

  /**
   * 指定したキーに対するロックを取得し、
   * 関数 onLockFn を排他制御下で実行し、ロック解除後にonLockFn の戻り値で解決される Promise を返す。
   *
   * @param {CallbackOnLock}  onLockFn      ロック取得後に実行するコールバック関数
   * @param {CallbackOnLock}  execWithLock  
   *  ロック取得、onLockFn呼び出し、ロック解除の一連の処理するコールバック関数
   * @param {BaseUserOptions} [options] タイムアウトなどのオプション（単位: 秒）
   *  - timeoutSec: ロック取得のタイムアウト時間。省略時はコンストラクタで指定された値を使用。
   * @return {Promise<*>} onLockFn の戻り値で解決される Promise
   * @abstract
   */
  protected async _withLock(onLockFn: CallbackOnLock, execWithLock: (cb: () => any, opt: T) => any, options: AllOptions<T, I>) {
    REQUIRE_DEBUG(onLockFn && typeof onLockFn === 'function', 'onLockFn不正', LockError, {code: 'EINVAL'});
    REQUIRE_DEBUG(execWithLock && typeof execWithLock === 'function', 'execWithLock不正', LockError, {code: 'EINVAL'});

    const execDependingOnReentry = () => {
      // 再帰ロックチェック準備
      const rc = this.getReentrantContext();
      if (!rc) {
        // まだ再入ロック検知のためのコンテキストがないので「新コンテキストを作って、その中でwithLockし直す」
        return this.runInNewContext(() => execDependingOnReentry());
      }
      // 再入ロックチェック
      if (this.isReentry()) {
        if (!options.allowReentry) throw new DeadlockDetected(null, { key: this.key });
        this.logger.trace("Allow re-entry locks in accordance with `options.allowReentry`.");
        options.ownerId = this.ownerId;
        // ロックカウンターをインクリメント
        this.incReantryCount(options);
        try {
          return this.execCallback(onLockFn, options);
        }
        catch (err) {
          //this.#setMonitor({ cancelled: true, reason: err.code ?? 'NO_CODE' }, opts);
          Object.assign(options.monitor, { cancelled: true, reason: err.code ?? 'NO_CODE' });
          //this.logger.error(' catch eror after update', err, '\nmonitor:', monitor);
          throw err;
        }
        finally {
          try {
            this.decReantryCount(options);
          }
          catch (err) {
            //this.#setMonitor({ cancelled: true, reason: err.code ?? 'NO_CODE' }, opts);
            Object.assign(options.monitor, { cancelled: true, reason: err.code ?? 'NO_CODE' });
            //this.logger.error(' catch eror after update', err, '\nmonitor:', monitor);
            throw err;
          }
        }
      }
      // withLockを実行する
      return execWithLock(() => this.execCallback(onLockFn, options), options);
    }
    
    return execDependingOnReentry();
  }

  /**
   * 再入ロックカウンターをインクリメント
   * @param {BaseUserOptions} options 
   */
  protected incReantryCount(options: AllOptions<T, I>) {
    throw new Error("継承クラスで実装せよ")
  }

  /**
   * 再入ロックカウンターをデクリメント
   * @param {BaseUserOptions} options 
   */
  protected decReantryCount(options: AllOptions<T, I>) {
    throw new Error("継承クラスで実装せよ")
  }

  /**
   * 子コンテキスト上でコールバック関数実行(for 再入ロック検出)
   * @param {function}  onLockFn  ロック中にコールバックする関数
   * @returns {Promise<*>}  onLockFnの戻り値を取得するPromise。
   */
  private execCallback(onLockFn: CallbackOnLock, options: AllOptions) {
    // この呼び出し専用のコンテキストを決定する
    const parent = this.getReentrantContext();
    let child: ReentrantContext;
    if (parent.heldLocks.has(this.key)) {
      // 再入ロック時は、monitorを親と共有
      const monitor = parent.heldLocks.get(this.contextId).monitor;
      options.monitor = monitor;
      child = parent;
    }
    else {
      child = { heldLocks: new Map(parent?.heldLocks) };
      child.heldLocks.set(this.contextId, { monitor: options.monitor });
    }
    // 専用コンテキストでonLockFn()を実行
    return LockBase.als.run(child, async () => onLockFn(options.monitor));
  }

  /**
   * 再入ロックか否かをチェックする
   */
  private isReentry(): boolean {
    return Boolean(this.getReentrantContext()?.heldLocks.has(this.contextId));
  }

  /**
   * 新しいコンテキストを作成し、そのコンテキスト上で関数fnを実行する
   * @param {function} fn 
   * @returns 
   */
  private runInNewContext(fn: () => any) {
    const initialContext: ReentrantContext = { heldLocks: new Map() };
    return LockBase.als.run(initialContext, () => {
      return fn();
    });
  }

  private getReentrantContext() : ReentrantContext {
    return LockBase.als.getStore();
  }

}

