// 利用モジュールの読み込み
import { Contracts } from '@ayapapa-npm/contracts-js';
import { AllOptions, AllOptionsKey } from './AllOptions.ts';
import { 
  type BaseUserOptions, 
  type KeyTypeMap, 
  type TimeBasedKey, 
  type MsKey, 
  type SecKey 
} from './BaseUserOptions.ts';
import { InvalidOptions } from './LockErrors.ts';
import { BaseInternalState } from './BaseInternalState.ts';

const {REQUIRE} = Contracts;

/**
 * A class that resolves options.
 * Base class: Accepts a generic type T
 * T must inherit from BaseUserOptions (constraint) 
 */
export class BaseOptionsResolver <T extends BaseUserOptions = BaseUserOptions, I extends BaseInternalState = BaseInternalState> {

  /** Static Fields. */
  
  /** Basic default options. */
  private static defaultOptions: BaseUserOptions = {
      timeoutMs:      5000,   // ロック解除待ち最大時間のデフォルトは5秒
      ttlMs:          10000,  // ロック有効期間(time to live)のデフォルトは10秒
      allowReentry:   false,  // 再入ロック禁止をデフォルトとする
  }

  /** Static methods. */

  /** Get basic default options. */
  public static getDefaultOptions(): BaseUserOptions {
    return BaseOptionsResolver.defaultOptions;
  }

  /** Instance fields. */

  /** Current options. */
  protected options: AllOptions<T, I>;

  /** Instance methods. */

  /**
   * Constructor
   * @param opts        User options.
   * @param defaultOpts Default options. If undefined or null, use getDefaultOptions()'s return values。
   */
  constructor(userOpts: T, defaultOpts?: T) {
     this.options = {
      ...userOpts,
      resolved: false,
    } as AllOptions<T, I>;

    this.#resolveOptions(defaultOpts);
  }

  /** Get basic default options. */
  public getDefaultOptions(): BaseUserOptions {
    return BaseOptionsResolver.defaultOptions;
  }

  /** Get current options. */
  public getOptions(): AllOptions<T, I> {
    return this.options;
  }

  /** Get the Key-Type map for type checking. */
  protected getCheckTypePairs(): KeyTypeMap<BaseUserOptions> {
    return {
      timeoutSec:   `number`,
      timeoutMs:    `number`,
      ttlSec:       `number`,
      ttlMs:        `number`,
      allowReentry: `boolean`,
   };
  }

  /**
   * Check each option's property type.
   */
  protected _checkTypes() {
    const pairs = this.getCheckTypePairs();

    typedKeys(pairs).forEach(key => {
      const t = pairs[key];
      const v = this.options[key];
      REQUIRE(!v || typeof t === 'function' && t(v) || typeof v === t, 
        `The type of option ${key} is incorrect.`, InvalidOptions, { name: key });
      });
  }

  /**
   * Get the array of time-related keys that require unit conversion (seconds to milliseconds). 
   * If a subclass handles extended options that include similar keys, override this function and add the relevant keys to the array. 
   * @returns Array of time-related keys requiring unit conversion (seconds to milliseconds).
   */
  protected _getTimeKeys(): TimeBasedKey<T>[] {
    return ['timeout', 'ttl'] as TimeBasedKey<T>[];
  }

  /**
   * Validate, transform, and complete the user options passed to the constructor.
   * @param defaultOpts  Defalt options
   */
  #resolveOptions(defaultOpts?: T) {
    this.#validateOptions();
    this.#normalizeOptions(defaultOpts);
    this.options.resolved = true;
  }

  /**
   * Validate options
   */
  #validateOptions() {
    // 型チェック
    this._checkTypes();
    // 併用チェック
    this.#checkCompeting();
  }

  /**
   * Transform, and complete options.
   * @param defaultOpts  Defalt options
   */
  #normalizeOptions(defaultOpts?: T): void {
    this._convSecToMs();

    Object.assign(this.options, { ...defaultOpts,  ...this.options});
    typedKeys(this.options).forEach(key => {
      if (this.options[key] == null) delete this.options[key];
    });
    Object.assign(this.options, { ...this.getDefaultOptions(), ...this.options });
  }

  /** get TimeBaseKey-> SecBaseKey map */
  #getSecKeyMap(keys: TimeBasedKey<T>[]): { [key: string]: AllOptionsKey<T> } {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec` as AllOptionsKey<T>])
    );
  }

  /** get TimeBaseKey-> MsBaseKey map */
  #getMsKeyMap(keys: TimeBasedKey<T>[]): { [key: string]: AllOptionsKey<T> } {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Ms` as AllOptionsKey<T>])
    );
  }

  /**
   * Check for conflicts in option values.
   */
  #checkCompeting() {
    const keys = this._getTimeKeys();
    const secKeyMap = this.#getSecKeyMap(keys);
    const msKeyMap = this.#getMsKeyMap(keys);
    keys.forEach(key => {
      const sec = secKeyMap[key];
      const ms  = msKeyMap[key];
      const k1  = this.options[sec], k2 = this.options[ms];
      REQUIRE(!k1 || !k2, `Options ${String(sec)} and ${String(ms)} cannot be specified at the same time.`, 
        InvalidOptions, { props: {keys: [sec, ms]} });
    });
  }

  /**
   * Optionsで指定された秒単位値をミリ秒単位に変換する
   */
  protected _convSecToMs() {
    const keys = this._getTimeKeys();
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
  }

/** Enumerate typed object keys. */
export function typedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}
