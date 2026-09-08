// 利用モジュールの読み込み
import { Contracts } from '@ayapapa-npm/contracts-js';
//import { AllOptions, AllOptionsKey } from './AllOptions.ts';
import { type LockBaseOptions, type LockBaseRequiredOptions } from './LockBaseOptions.ts';
import { InvalidOptions } from './LockBaseErrors.ts';
import { FileLockError } from './FileLockErrors.ts';
//import { LockBaseInternalState } from './LockBaseInternalState.ts';

const {REQUIRE} = Contracts;

/** Types of time-based key. */
export type TimeBasedKey<T> = {
  [K in keyof T]:
    K extends `${infer Base}Sec`
      ? `${Base}Ms` extends keyof T
        ? Base
        : never
      : never
}[keyof T];


/** Type of Key-Type map. */
export type KeyTypeMap<T> = Record<keyof T, any>;

/**
 * @internal
 */

/** Types of seconds-time-based key. */
type SecKey<T> = `${TimeBasedKey<T>}Sec`;

/** Types of millisecond-time-based key. */
type MsKey<T> = `${TimeBasedKey<T>}Ms`;


//export type CompetingKeysType<TOption, T extends TimeBasedKey<TOption> = TimeBasedKey<TOption>> = T[];

/**
 * @internal
 * A class that resolves options.
 * Base class: Accepts a generic type U
 * U must inherit from LockBaseOptions (constraint) 
 */
export class LockBaseOptionsResolver <U extends LockBaseOptions = LockBaseOptions, R extends LockBaseRequiredOptions = LockBaseRequiredOptions> {
  //I extends LockBaseInternalState = LockBaseInternalState> {

  /** Static methods. */

  public static isRequiredOptions<O extends object, D extends object>(options: O, defaults: D, missings?: string[]): boolean {
    const keys = Object.keys(defaults) as (keyof O)[];
    let ret = true;
    for (const key of keys) {
      if (options[key] == null) {
        ret = false;
        missings?.push(String(key));
      }
    }
    return ret;
  }

  /** Instance fields. */

  /** Current options. */
  protected options: U; //AllOptions<U, I>;

  protected defaultOptions?: R;//AllOptions<U, I>;

  /** Instance methods. */

  /**
   * Constructor
   * @param opts        User options.
   * @param defaultOptions Default options.
   */
  constructor(userOpts: U, defaultOptions?: R) {
    if ('_resolvedOpts' in userOpts) delete userOpts._resolvedOpts;

    this.options = { ...userOpts };// as AllOptions<U, I>;
    if (defaultOptions) this.defaultOptions = { ...defaultOptions };

    this.#resolveOptions(defaultOptions);

    Object.assign(userOpts, { _resolvedOpts: this.options })

  }

  /** Get options. */
  public getOptions(): U/*AllOptions<U, I>*/ {
    return this.options;
  }

  /** Get an option consisting of required properties. Error if any properties are missing. */
  //public getRequiredOptions/*<K extends keyof U>*/(/*keys: readonly K[]*/): R/*AllOptions<Required<Pick<U, K>>, I>*/ {
  public getRequiredOptions(): R {
    if (!this.defaultOptions) {
      throw new FileLockError("To generate required options, specify default options in the constructor.", { code: 'EFILELOCK' });
    }
    
    const missings: string[] = [];
    if (LockBaseOptionsResolver.isRequiredOptions(this.options, this.defaultOptions, missings)) {
      // 必須キー構成のオプションであることを確認済みのため、型キャストして返す。
      return this.options as unknown as R;
    }

    throw new FileLockError(`Missing required option: ${missings}`, { code: 'EFILELOCK' })
  }

  /**
   * @internal
   *  Get the Key-Type map for type checking. 
   */
  protected _getCheckTypePairs(): KeyTypeMap<LockBaseOptions> {
    return {
      timeoutSec:   `number`,
      timeoutMs:    `number`,
      ttlSec:       `number`,
      ttlMs:        `number`,
      allowReentry: `boolean`,
   };
  }

  /**
   * @internal
   * Get the array of time-related keys that require unit conversion (seconds to milliseconds). 
   * If a subclass handles extended options that include similar keys, override this function and add the relevant keys to the array. 
   * @returns Array of time-related keys requiring unit conversion (seconds to milliseconds).
   */
  protected _getTimeKeys(): TimeBasedKey<U>[] {
    return ['timeout', 'ttl'] as TimeBasedKey<U>[];
  }

  /**
   * @internal
   * Transform, and complete options.
   * @param defaultOptions  User default options
   * @protected
   */
  protected _normalizeOptions(defaultOptions?: R): void {
    this.#convSecToMs();

    Object.assign(this.options, { ...defaultOptions,  ...this.options});
  }

  /**
   * Check each option's property type.
   */
  #checkTypes() {
    const pairs = this._getCheckTypePairs();

    typedKeys(pairs).forEach(key => {
      const t = pairs[key];
      const v = this.options[key];
      REQUIRE(key in this.options === false || /*typeof t === 'function' && t(v) ||*/ typeof v === t, 
        `The type of option ${key} is incorrect.`, InvalidOptions, { name: key });
      });
  }

  /**
   * Validate, transform, and complete the user options passed to the constructor.
   * @param defaultOpts  Defalt options
   */
  #resolveOptions(defaultOpts?: R) {
    this.#validateOptions();
    this._normalizeOptions(defaultOpts);
  }

  /**
   * @internal
   * Validate options.
   */
  #validateOptions() {
    // 型チェック
    this.#checkTypes();
    // 併用チェック
    this.#checkCompeting();
  }

  /** 
   * @internal
   * get TimeBaseKey-> SecBaseKey map.
   */
  #getSecKeyMap(keys: TimeBasedKey<U>[]): { [key: string]:keyof U/* AllOptionsKey<U>*/ } {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec` as keyof U/*AllOptionsKey<U>*/])
    );
  }

  /**
   * @internal
   * get TimeBaseKey-> MsBaseKey map.
   */
  #getMsKeyMap(keys: TimeBasedKey<U>[]): { [key: string]: keyof U/*AllOptionsKey<U>*/ } {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Ms` as keyof U/*AllOptionsKey<U>*/])
    );
  }

  /**
   * @internal
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
   * @internal
   * Convert a value in seconds to milliseconds.
   */
  #convSecToMs() {
    const keys = this._getTimeKeys();
    // Treat this.options as a type containing only the time key (type assertion)
    // Here, use 'as unknown as ...' to safely cast via unknown
    const optionsAsNumbers = this.options as unknown as Partial<Record<SecKey<U> | MsKey<U>, number>>
    
    keys.forEach(key => {
      const fromKey = `${key}Sec` as SecKey<U>;
      const toKey = `${key}Ms` as MsKey<U>;

      const value = optionsAsNumbers[fromKey];

      if (value != null) {
        optionsAsNumbers[toKey] = Math.floor(value * 1000);
        delete optionsAsNumbers[fromKey];
      }
    });
  }
}

/** Enumerate typed object keys. */
export function typedKeys<U extends object>(obj: U): Array<keyof U> {
  return Object.keys(obj) as Array<keyof U>;
}
