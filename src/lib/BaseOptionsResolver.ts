// 利用モジュールの読み込み
import { Contracts } from '@ayapapa-npm/contracts-js';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';
import { 
  typedKeys, 
  type BaseUserOptions, 
  type KeyTypeMap, 
  type AllOptions, 
  type AllOptionsKey, 
  type TimeBasedKey, 
  type MsKey, 
  type SecKey 
} from './BaseUserOptions.ts';
import { LockError } from './FileLockErrors.ts';

const {REQUIRE, VERIFY, REQUIRE_DEBUG} = Contracts;
const logger = new PrettyConsole();


// The general type for Options (accepting a generic T)
//export type AllOptions<T extends BaseUserOptions = BaseUserOptions> = T & InternalState;
//export type AllOptionsKey<T extends BaseUserOptions = BaseUserOptions> = keyof AllOptions<T>;

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

  public getDefaultOptions(): BaseUserOptions {
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
  constructor(opts: T, defaultOpts?: T) {
     this.options = {
      ...opts,
      resolved: false,
    } as AllOptions<T>;

    this.resolveOptions(defaultOpts);
  }

  public getOptions(): AllOptions<T> {
    return this.options;
  }

  /**
   * ユーザーオプションを検証後、内部用に一部変更・補完した結果を取得する。
   * @param {ojbect} defaultOpts  デフォルトオプション
   */
  resolveOptions(defaultOpts?: T) {
    this.validateOptions();
    this.normalizeOptions(defaultOpts);
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
  normalizeOptions(defaultOpts?: T) {
    // 単位変換
    this.convSecToMs();
    // デフォルト埋め ★★★　defaultOptionsのオーバーライド！！！
    const defOpts = defaultOpts || this.getDefaultOptions();
    Object.assign(this.options, {...defOpts, ...this.options});
  }

  protected getCheckTypePairs(): KeyTypeMap<BaseUserOptions> {
    return {
      timeoutSec:   `number`,
      timeoutMs:    `number`,
      ttlSec:       `number`,
      ttlMs:        `number`,
      allowReentry: `boolean`,
      logger:       (value: any) =>  {
        return typeof value === 'object' &&
          typeof (value as any).log   === 'function' &&
          typeof (value as any).trace === 'function' &&
          typeof (value as any).debug === 'function' &&
          typeof (value as any).info  === 'function' &&
          typeof (value as any).warn  === 'function' &&
          typeof (value as any).error === 'function';
      },
    };
    
  }

    /**
   * ユーザーオプションの値の型をチェックする
   */
  checkTypes() {
    const pairs = this.getCheckTypePairs();

    typedKeys(pairs).forEach(key => {
      const t = pairs[key];
      const v = this.options[key];
      REQUIRE(!v || typeof t === 'function' && t(v) || typeof v === t, 
        `オプション${key}の型が正しくありません`, LockError, {code: 'EINVAL', key});
      });
  }

  /*
  protected getCompetingKeys(): CompetingKeysType<T, TimeBasedKey<T>>[] {
    return ['timeout', 'ttl'] as CompetingKeysType<T, TimeBasedKey<T>>[];
  }
  */
 
  /**
   * Get the array of time-related keys that require unit conversion (seconds to milliseconds). 
   * If a subclass handles extended options that include similar keys, override this function and add the relevant keys to the array. 
   * @returns Array of time-related keys requiring unit conversion (seconds to milliseconds).
   */
  protected getTimeKeys(): TimeBasedKey<T>[] {
    return ['timeout', 'ttl'] as TimeBasedKey<T>[];
  }

  private getSecKeyMap(keys: TimeBasedKey<T>[]) {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec}`])
    );
  }

  private getMsKeyMap(keys: TimeBasedKey<T>[]) {
    return Object.fromEntries(
      keys.map(key => [key as TimeBasedKey<T>, `${key}Ms}`])
    );
  }

  /**
   * ユーザーオプションの値の競合をチェックする
   * @param keys  チェック対象のキー配列の配列
   */
  private checkCompeting() {
    const keys = this.getTimeKeys();
    const secKeyMap = this.getSecKeyMap(keys);
    const msKeyMap = this.getMsKeyMap(keys);
    keys.forEach(key => {
      const sec = secKeyMap[key] as AllOptionsKey<T>;
      const ms  = msKeyMap[key]  as AllOptionsKey<T>;
      const k1  = this.options[sec], k2 = this.options[ms];
      REQUIRE(!k1 || !k2, `オプション${String(sec)}と${String(ms)}は同時に指定できません`, 
        LockError, {code: 'EINVAL', props: {keys: [sec, ms]} });
    });
  }

  /**
   * Optionsで指定された秒単位値をミリ秒単位に変換する
   */
  convSecToMs() {
    const keys = this.getTimeKeys();
    // this.options を、時間キーのみを含む型として扱う（型アサーション）
    // ここでは 'as unknown as ...' を使って、一度 unknown を経由させて安全にキャストする
    const optionsAsNumbers = this.options as unknown as Partial<Record<SecKey<T> | MsKey<T>, number>>
    
    keys.forEach(key => {
      const fromKey = `${key}Sec` as SecKey<T>;
      const toKey = `${key}Ms` as MsKey<T>;

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
