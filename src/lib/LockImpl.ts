// 利用モジュールの読み込み
import { AsyncLocalStorage } from 'node:async_hooks';
import { Contracts } from '@ayapapa-npm/contracts-js';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';
import { AnyMxRecord } from 'node:dns';
//import {LockImplInterface, LockError, DeadlockDetected} from '../core/LockImplInterface.js';

const {REQUIRE, VERIFY, REQUIRE_DEBUG} = Contracts;
const logger = new PrettyConsole();

export type LogProvider = Pick<Console, 'debug'>;

interface ReentrantContext  {
  /** Set of reentrant context ids */
  heldLocks: Set<string>;
}

/** Monitoring object passed to the callback function executed after acquiring the lock. */
export interface Monitor {
  /** Whether the operation was canceled. */
  canceled: boolean;
}

/** Definition of the callback function to be executed after acquiring the lock. */
export type CallbackOnLock = (monitor: Monitor) => any;

export interface BaseUserOptions {
  /** 
   * Maximum wait time (in seconds) to acquire the lock. 
   *  Cannot be used in conjunction with `timeoutMs`; it is internally converted to `timeoutMs`. The default value is the same as the default for `timeoutMs`.
   */
  timeoutSec?: number;

  /**
   * Maximum wait time to acquire the lock [milliseconds]. 
   *  Cannot be used in conjunction with timeoutSec. Default is 5000.
   */
  timeoutMs?: number;

  /**
   * Lock validity period (time to live)—i.e., the maximum time [seconds] from lock acquisition
   * until the callback function completes execution. An error (TTLExceeded) occurs if this period is exceeded.
   * Cannot be used in conjunction with ttlMs; it is internally converted to ttlMs. Defaults to the default value for ttlMs.
   */
  ttlSec?: number

  /**
   * Lock validity period (time to live): the maximum time [milliseconds] from lock acquisition
   *  until the callback function completes execution. An error (TTLExceeded) occurs if this
   *  period is exceeded. Cannot be used in conjunction with ttlSec. Default is 10000.
   */
  ttlMs?: number;

  /**
   *  Controls the behavior when attempting to acquire a lock using the same key while already holding a lock for that key. 
   *  The default is false (re-entrant locking is prohibited; a DeadlockDetected error is thrown upon detection). 
   *
   *  If true:
   *    You can proceed to acquire the lock (via withLock) using the same key,
   *    even if you already hold a lock for that key. 
   *    Use this setting when you need to allow recursive calls or wrapper functions
   *    that re-acquire the lock using the same key from within the locked block. 
   *    Internally, the system increments a lock counter instead of re-acquiring the lock. 
   *
   *  If false:
   *    If you attempt to acquire a lock using the same key while already holding it,
   *    a DeadlockDetected error is thrown immediately. 
   *
   *    Setting allowReentry to true creates the possibility of
   *    "processes protected by the same key" executing in an overlapping manner. 
   *    If the process already running under the lock (the initial phase)
   *    and the re-entering process (the subsequent phase) read or write to the same shared resource
   *    (such as in-memory data structures, files, or caches),
   *    the execution order or state transitions may yield unexpected results. 
   *
   *    For example, while a shared object is being updated within the locked block,
   *    a re-entering process using the same key might overwrite that object with a different value,
   *    leading to interference between the initial and subsequent processes. 
   *
   *    When enabling allowReentry,
   *    limit its use to processes where re-entry is known to be safe
   *    (such as read-only operations or operations where repeating the same action causes no inconsistencies). 
   */
   allowReentry?: boolean;

   /**
    * Specifies external logger. 
    * Default is `console`.
    */
   logger?: LogProvider;
}

/** Type of `Options` key */
export type OptionsKey<T> = keyof T;// extends BaseUserOptions;

/** Types of time-based keys. */
/*
export type TimeBasedKey = "timeout" | "ttl";
export type SecKey = `${TimeBasedKey}Sec`;
export type MsKey = `${TimeBasedKey}Ms`;
*/
export type TimeBasedKey<T> = {
  [K in keyof T]:
    K extends `${infer Base}Sec`
      ? `${Base}Ms` extends keyof T
        ? Base
        : never
      : never
}[keyof T];
export type SecKey<T> = `${TimeBasedKey<T>}Sec`;
export type MsKey<T> = `${TimeBasedKey<T>}Ms`;

export type KeyTypeMap<T> = Record<OptionsKey<T>, string>;

export type CompetingKeysType<TOption, T extends TimeBasedKey<TOption> = TimeBasedKey<TOption>> = T[];

/** Enumerate typed object keys. */
function typedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

interface InternalState {
  /** Whether the BaseUserOptions was resolved. */
  resolved?: boolean;

  /** Lock owner id. */
  ownerId?: string;

  monitor?: Monitor;
}

// The general type for Options (accepting a generic T)
type AllOptions<T extends BaseUserOptions = BaseUserOptions> = T & InternalState;
type AllOptionsKey<T extends BaseUserOptions = BaseUserOptions> = keyof AllOptions<T>;

/**
 * A class that resolves options.
 * Base class: Accepts a generic type T
 * T must inherit from BaseUserOptions (constraint) 
 */
export class BaseOptionsResolver <T extends BaseUserOptions = BaseUserOptions> {
  
  protected options: AllOptions<T>;

  private static defaultOptions: BaseUserOptions = {
      timeoutMs:      5000,   // ロック解除待ち最大時間のデフォルトは5秒
      ttlMs:          10000,  // ロック有効期間(time to live)のデフォルトは10秒
      allowReentry:   false,  // 再入ロック禁止をデフォルトとする
      //resolved:       false,
      logger:         console
  }

  public static getDefaultOptions(): BaseUserOptions {
    return BaseOptionsResolver.defaultOptions;
  }

/** Whether the BaseUserOptions was resolved. */
//resoleved: boolean = false;

/** 
 * Maximum wait time (in seconds) to acquire the lock. 
 */
//timeoutSec?: number;

/**
 * Maximum wait time to acquire the lock [milliseconds]. 
 */
//timeoutMs?: number;

/**
 * Lock validity period (time to live)—i.e., the maximum time [seconds] from lock acquisition
 * until the callback function completes execution. An error (TTLExceeded) occurs if this period is exceeded.
 */
//ttlSec?: number

/**
 * Lock validity period (time to live): the maximum time [milliseconds] from lock acquisition
 *  until the callback function completes execution. An error (TTLExceeded) occurs if this
 *  period is exceeded. Cannot be used in conjunction with ttlSec. Default is 10000.
 */
//ttlMs?: number;

/**
 *  Controls the behavior when attempting to acquire a lock using the same key while already holding a lock for that key. 
 *  The default is false (re-entrant locking is prohibited; a DeadlockDetected error is thrown upon detection). 
 */
//  allowReentry?: boolean;

//  protected resolved: boolean = false;

  /**
   * コンストラクタ
   * @param opts
   */
  constructor(opts: T) {
     this.options = {
      ...opts,
      resolved: false,
    } as AllOptions<T>;

    this.resolveOptions();
  }

  public getOptions(): AllOptions<T> {
    return this.options;
  }

  /**
   * ユーザーオプションを検証後、内部用に一部変更・補完した結果を取得する。
   * @param {ojbect} defaultOpts  デフォルトオプション
   */
  resolveOptions() {
    this.validateOptions();
    this.normalizeOptions();
    this.options.resolved = true;
  }

  /*
  type KeyTypePair = {

  }
*/
  /**
   * オプションの妥当性をチェックする。
   * @param {BaseUserOptions} opts  オプション
   */
  validateOptions() {
    // 型チェック
    this.checkTypes();
    // 併用チェック
    this.checkCompeting();
  }

  /**
   * オプションを内部用に一部変更・補完（デフォルト埋め、別名サポート、値の変換など）
   * @param {BaseUserOptions} defaultOpts  デフォルトオプション
   * @return {objects}
   */
  normalizeOptions() {
    // 単位変換
    this.convSecToMs();
    // デフォルト埋め
    Object.assign(this.options, {...BaseOptionsResolver.defaultOptions, ...this.options});
  }

  protected getCheckTypePairs(): KeyTypeMap<BaseUserOptions> {
    return {
       timeoutSec:   `number`,
       timeoutMs:    `number`,
       ttlSec:       `number`,
       ttlMs:        `number`,
       allowReentry: `boolean`,
       logger:       `LogProvider`,
    };// as const; //satisfies KeyTypeMap<BaseUserOptions>;
  }
  /**
   * ユーザーオプションの値の型をチェックする
   */
  checkTypes() {
    const pairs = this.getCheckTypePairs();

    typedKeys(pairs).forEach(key => {
      const type = pairs[key];
      const v = this.options[key];
      REQUIRE(!v || typeof v === type, 
        `オプションの${key}が${type}型ではありません`, LockError, {code: 'EINVAL', key});
    })
  }

  /*
  protected getCompetingKeys(): CompetingKeysType<T, TimeBasedKey<T>>[] {
    return ['timeout', 'ttl'] as CompetingKeysType<T, TimeBasedKey<T>>[];
  }
  */
  protected getTimeKeys(): string[] {
    return ['timeout', 'ttl'];
  }

  private getSecKeyMap(keys: string[]) {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec}`])
    );
  }

  private getMsKeyMap(keys: string[]) {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Ms}`])
    );
  }

  /**
   * ユーザーオプションの値の競合をチェックする
   * @param keys  チェック対象のキー配列の配列
   */
  checkCompeting() {
    const keys = this.getTimeKeys();
    const secKeyMap = this.getSecKeyMap(keys);
    const msKeyMap = this.getMsKeyMap(keys);
    keys.forEach(key => {
      const sec = secKeyMap[key as keyof typeof secKeyMap];
      const ms  = msKeyMap[key as keyof typeof msKeyMap];
      const k1  = this.options[sec as AllOptionsKey<T>], k2 = this.options[ms as AllOptionsKey<T>];
      REQUIRE(!k1 || !k2, `オプション${sec}と${ms}は同時に指定できません`, LockError, {code: 'EINVAL', keys: [sec, ms]});
    });
  }

  /**
   * Optionsで指定された秒単位値をミリ秒単位に変換する
   */
  convSecToMs() {
    const keys = this.getTimeKeys(); // string[]

    // 1. この関数内で扱う「数値キーのみの型」を定義する
    // keyof this.options の中から、値が number であるものだけを抽出する
    type NumberOnlyKeys = {
      [K in keyof typeof this.options]: typeof this.options[K] extends number ? K : never;
    }[keyof typeof this.options];

    // 2. this.options を、数値キーのみを含む型として扱う（型アサーション）
    // ここでは 'as unknown as ...' を使って、一度 unknown を経由させて安全にキャストする
    const optionsAsNumbers = this.options as unknown as Partial<Record<NumberOnlyKeys, number>>
    
  keys.forEach(key => {
    const fromKey = `${key}Sec` as NumberOnlyKeys;
    const toKey = `${key}Ms` as NumberOnlyKeys;

    const value = optionsAsNumbers[fromKey];

    if (value != null) {
      optionsAsNumbers[toKey] = Math.floor(value * 1000);
      delete optionsAsNumbers[fromKey];
    }
  });
  }
  
/*
    const setToMsMap = Object.fromEntries(
      keys.map(key => [`${key}Sec`, `${key}Ms}`])
    );

    for (const from of Object.keys(setToMsMap)) {
      const value = this.options[from as AllOptionsKey<T>] as number;
      if (value != null) {
        const to = setToMsMap[from];
        this.options[to as AllOptionsKey<T>] = Math.floor(value * 1000);
        delete this.options[from as AllOptionsKey<T>];
      }
    }
  }
*/
}

/**
 * 排他制御（ロック）実装の基本クラス。
 * AsyncLocalStorage を利用して、リエントラントロック（再入ロック）の回避を行う。
 *
 * 注意: AsyncLocalStorage によるリエントラントロック（再入ロック）の回避は、
 * 同一 Node プロセス内の同じ非同期コンテキストにのみ有効。
 * コンテキスト内にける別プロセス起動先でのロックの再入制御までは行えない。
 * @class LockImpl
 * @extends LockImplInterface
 */
export class LockImpl <T extends BaseUserOptions = BaseUserOptions>  {
  /**
   * フィールド
   */

  /** Lock owner id. */
  protected ownerId: string = '';

  /** AsyncLocalStorage（リエントラントロック検出に利用） */
  private als: AsyncLocalStorage<ReentrantContext>;

  /** コンテキストID（リエントラントロック検出用） */
  private contextId: string;

  /**
   * コンストラクタ。
   */
  constructor() {
    this.als = new AsyncLocalStorage<ReentrantContext>();
    this.contextId  = crypto.randomUUID();
  }

  /**
   * デフォルトオプションを取得する
   * @returns {object}
   */
  public defaultOptions(): BaseUserOptions  {
    return BaseOptionsResolver.getDefaultOptions();
    /*
    return {
      timeoutMs:      5000,   // ロック解除待ち最大時間のデフォルトは5秒
      ttlMs:          10000,  // ロック有効期間(time to live)のデフォルトは10秒
      allowReentry:   false,  // 再入ロック禁止をデフォルトとする
      resolved:       false,
      logger:         console
    };
    */
  }

  /**
   * ユーザーオプションを検証後、内部用に一部変更・補完した結果を取得する。
   * @param {BaseUserOptions}    opts デフォルトオプション
   * @param {function}      [optsCls]     オプションクラス
   * @returns {BaseUserOptions}
   */
//  private resolveOptions(opts: T, optsCls = BaseOptionsResolver): AllOptions<T> {
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
  async _withLock(onLockFn: () => any, execWithLock: (cb: () => any, opt: T) => any, options: AllOptions<T>) {
    //const rOpts = this.resolveOptions(options) as AllOptions<T>;
    const rOpts = {...options};
    REQUIRE_DEBUG(onLockFn && typeof onLockFn === 'function', 'onLockFn不正', LockError, {code: 'EINVAL'});
    REQUIRE_DEBUG(execWithLock && typeof execWithLock === 'function', 'execWithLock不正', LockError, {code: 'EINVAL'});

    const execDependingOnReentry = () => {
      // 再帰ロックチェック準備
      const store = this.als.getStore();
      if (!store) {
        // まだ再入ロック検知のためのコンテキストがないので「新コンテキストを作って、その中でwithLockし直す」
        return this.runInNewContext(() => execDependingOnReentry());
      }
      // 再入ロックチェック
      if (this.isReentry()) {
        if (!rOpts.allowReentry) throw new DeadlockDetected();
        logger.trace("options.allowReentryに従い再入ロックを許可");
        rOpts.ownerId = this.ownerId;
        // ロックカウンターをインクリメントして処理実行
        this.incReantryCount(rOpts);
        try {
          return this.execCallback(onLockFn);
        }
        finally {
          this.decReantryCount(rOpts);
        }
      }
      // withLockを実行する
      return execWithLock(() => this.execCallback(onLockFn), rOpts);
    }
    
    return execDependingOnReentry();
  }

  /**
   * 再入ロックカウンターをインクリメント
   * @param {BaseUserOptions} options 
   */
  protected incReantryCount(options: AllOptions<T>) {
    throw new Error("継承クラスで実装せよ")
  }

  /**
   * 再入ロックカウンターをデクリメント
   * @param {BaseUserOptions} options 
   */
  protected decReantryCount(options: AllOptions<T>) {
    throw new Error("継承クラスで実装せよ")
  }

  /**
   * 子コンテキスト上でコールバック関数実行(for 再入ロック検出)
   * @param {function}  onLockFn  ロック中にコールバックする関数
   * @returns {Promise<*>}  onLockFnの戻り値を取得するPromise。
   */
  private execCallback(onLockFn: () => any) {
    // この呼び出し専用の子コンテキストを作る
    const store = this.als.getStore();
    const childContext: ReentrantContext = { heldLocks: new Set(store?.heldLocks) };
    childContext.heldLocks.add(this.contextId);
    // 子コンテキストでロック取得＆onLockFn 実行
    return this.als.run(childContext, async () => onLockFn());
  }

  /**
   * 再入ロックか否かをチェックする
   */
  private isReentry(): boolean {
    return Boolean(this.als.getStore()?.heldLocks.has(this.contextId));
  }

  /**
   * 新しいコンテキストを作成し、そのコンテキスト上で関数fnを実行する
   * @param {function} fn 
   * @returns 
   */
  runInNewContext(fn: () => any) {
    const initialContext: ReentrantContext = { heldLocks: new Set() };
    return this.als.run(initialContext, () => {
      return fn();
    });
  }

}

/**
 * Basic lock handling error. 
 */
class LockError extends Error {
  /**
   * Constructor.
   * @param msg   Error message.
   * @param params  Parameters.
   * @param code  Error code string.
   * @param props A set of arbitrary properties to be attached to the error instance.
   */
  constructor(msg = '', params?: {code?: string, props?: { [key: string]: any } }) {
    super(msg);
    const props = {...params?.props};
    const code = (params?.code) ?? 'ELOCK';
    Object.assign(this, { code, ...props });
  }
};

/**
 * Deadlock detection error. 
 */
class DeadlockDetected extends LockError {
  /**
   * Constructor.
   * @param params  Parameters.
   */
  constructor(msg?: string | null, params?: { props?: { [key: string]: any } }) {
    msg = msg || 'A deadlock was detected.';
    super(msg, { code: 'EDEADLK' , props: params?.props });
  }
};

/**
 * TTL exceeded error.
 */
export class TTLExceeded extends LockError {
  /**
   * Constructor.
   * @param params  Parameters.
   * @param props A set of arbitrary properties to be attached to the error instance.
   */
  constructor(msg?: string | null, params?: { ttlMs: string, props?: {[key: string]: any} }) {
    const ttlMs = params?.ttlMs;
    msg = msg || `The maximum processing time(${ttlMs ?? "options.ttlMs"} milliseconds) while locked has been exceeded.`;
    const props = {...params?.props};
    if (ttlMs) props[ttlMs] = ttlMs;
    super(msg, { code: 'ETTLEXCEEDED', props });
  }
};

/** Already locked error. */
export class AlreadyLocked extends LockError {
  /**
   * Constructor.
   * @param code    Error code string.
   * @param key     Lock key.
   * @param params  Parameters.
   */
  constructor(msg?: string | null, params?: {key: string, props?: {[key: string]: any} } ) {
    const key = params?.key;
    msg = msg || `Could not lock because the '${key ?? "key"}' is already locked.`;
    const props = {...params?.props};
    if (key) props[key] = key;
    super(msg, { code:'ELOCKED' , props });
  }
}

