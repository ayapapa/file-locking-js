// 利用モジュールの読み込み
import { Contracts } from '@ayapapa-npm/contracts-js';
import { type LockBaseOptions, type LockBaseMinimumOptions, type LockBaseRequiredOptions } from './LockBaseOptions.ts';
import { InvalidOptions } from './LockBaseErrors.ts';

const {REQUIRE, REQUIRE_DEBUG, VERIFY_DEBUG} = Contracts;

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
export class LockBaseOptionsResolver <
  O extends LockBaseOptions = LockBaseOptions,
  M extends LockBaseMinimumOptions = LockBaseMinimumOptions,
  R extends LockBaseRequiredOptions = LockBaseRequiredOptions,
  > {
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
  protected options: O; //AllOptions<O, I>;

  protected defaultOptions?: R | null;//AllOptions<O, I>;

  protected minimumOptions: M;

  /** Instance methods. */

  /**
   * Constructor
   * @param opts        User options.
   * @param defaultOptions Default options.
   */
  constructor(userOpts: O, minimumOptions: M, defaultOptions?: R) {
    if ('_resolvedOpts' in userOpts) delete userOpts._resolvedOpts;

    this.options = { ...userOpts };// as AllOptions<O, I>;
    this.minimumOptions = { ...minimumOptions };
    // Avoid using an if-statement to address a coverage issue.
    this.defaultOptions = defaultOptions ? { ...defaultOptions } : null;

    this.#resolveOptions();

    Object.assign(userOpts, { _resolvedOpts: this.options })

  }

  /** Get options. */
  public getOptions(): O/*AllOptions<O, I>*/ {
    return this.options;
  }

  /** 
   * Get an option consisting of required properties. Error if any properties are missing. 
   */
  public getRequiredOptions(): R {
    if (!this.defaultOptions) {
      throw new InvalidOptions("To generate required options, specify `defaultOptions` in the constructor.", { name: 'this.defaultOptions' });
    }
    
    const missings: string[] = [];
    if (LockBaseOptionsResolver.isRequiredOptions(this.options, this.defaultOptions, missings)) {
      // 必須キー構成のオプションであることを確認済みのため、型キャストして返す。
      return this.options as unknown as R;
    }
    else {
      throw new InvalidOptions(`Missing required option: ${missings}`, { name: 'this.options', props: { options: this.options } })
    }
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
  protected _getTimeKeys(): TimeBasedKey<O>[] {
    return ['timeout', 'ttl'] as TimeBasedKey<O>[];
  }

  /**
   * @internal
   * Transform, and complete options.
   * @param defaultOptions  User default options
   * @protected
   */
  protected _normalizeOptions(): void {
    this.#convSecToMs();

    // Apply minimum value
    this.#applyMinimum();    

    // Apply default values
    this.#applyDefaults();
  } 

  #applyMinimum() {
    // Since property type inference does not work as expected, cast the object to Record<string, number>
    // and perform validation to ensure type safety.
    const min = this.minimumOptions as Record<string, number>;
    const opt = this.options as unknown as Record<string, number>;

    REQUIRE_DEBUG(
      Object.values(min).every((value) => typeof value === 'number'),
      'The minimum options set (minimumOptions) contains properties that are not numbers.',
      InvalidOptions,
      { name: 'this->minimumOptions', props: { minimumOptions: min } }
    );

    const keys = Object.keys(this.minimumOptions);
    keys.forEach((key) => {
      if (key in this.options) {

        VERIFY_DEBUG(
          typeof opt[key] === 'number',
          `The value of the option property (${key}) must be a number.`,
          InvalidOptions,
          { name: 'this->options', props: { key, value: opt[key] } }
        );

        opt[key] = Math.max(opt[key], min[key]);
      }
    });
  }

  #applyDefaults() {
    Object.assign(this.options, { ...this.defaultOptions,  ...this.options});
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
  #resolveOptions() {
    this.#validateOptions();
    this._normalizeOptions();
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
  #getSecKeyMap(keys: TimeBasedKey<O>[]): { [key: string]:keyof O/* AllOptionsKey<U>*/ } {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec` as keyof O/*AllOptionsKey<U>*/])
    );
  }

  /**
   * @internal
   * get TimeBaseKey-> MsBaseKey map.
   */
  #getMsKeyMap(keys: TimeBasedKey<O>[]): { [key: string]: keyof O/*AllOptionsKey<U>*/ } {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Ms` as keyof O/*AllOptionsKey<O>*/])
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
    const optionsAsNumbers = this.options as unknown as Partial<Record<SecKey<O> | MsKey<O>, number>>
    
    keys.forEach(key => {
      const fromKey = `${key}Sec` as SecKey<O>;
      const toKey = `${key}Ms` as MsKey<O>;

      const value = optionsAsNumbers[fromKey];

      if (value != null) {
        optionsAsNumbers[toKey] = Math.floor(value * 1000);
        delete optionsAsNumbers[fromKey];
      }
    });
  }
}

/** Enumerate typed object keys. */
export function typedKeys<O extends object>(obj: O): Array<keyof O> {
  return Object.keys(obj) as Array<keyof O>;
}
