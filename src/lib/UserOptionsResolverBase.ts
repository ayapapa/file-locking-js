// 利用モジュールの読み込み
import { Contracts } from '@ayapapa-npm/contracts-js';
import { AllOptions, AllOptionsKey } from './AllOptions.ts';
import { type UserOptionsBase } from './UserOptionsBase.ts';
import { InvalidOptions } from './LockErrorsBase.ts';
import { InternalStateBase } from './InternalStateBase.ts';

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

/** Types of seconds-time-based key. */
type SecKey<T> = `${TimeBasedKey<T>}Sec`;

/** Types of millisecond-time-based key. */
type MsKey<T> = `${TimeBasedKey<T>}Ms`;

//export type CompetingKeysType<TOption, T extends TimeBasedKey<TOption> = TimeBasedKey<TOption>> = T[];

/**
 * A class that resolves options.
 * Base class: Accepts a generic type T
 * T must inherit from UserOptionsBase (constraint) 
 */
export class UserOptionsResolverBase <T extends UserOptionsBase = UserOptionsBase, I extends InternalStateBase = InternalStateBase> {

  /** Static Fields. */
  
  /** Basic default options. */
  private static defaultOptions: UserOptionsBase = {
    timeoutMs:      5000,   // Default maximum wait time for lock release is 5 seconds
    ttlMs:          10000,  // Default lock validity period (time to live) is 10 seconds
    allowReentry:   false,  // Default to disallowing re-entrant locks
  };

  /** Static methods. */

  /** Get basic default options. */
  public static getDefaultOptions(): UserOptionsBase {
    return UserOptionsResolverBase.defaultOptions;
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
  public getDefaultOptions(): UserOptionsBase {
    return UserOptionsResolverBase.defaultOptions;
  }

  /** Get current options. */
  public getOptions(): AllOptions<T, I> {
    return this.options;
  }

  /** Get the Key-Type map for type checking. */
  protected _getCheckTypePairs(): KeyTypeMap<UserOptionsBase> {
    return {
      timeoutSec:   `number`,
      timeoutMs:    `number`,
      ttlSec:       `number`,
      ttlMs:        `number`,
      allowReentry: `boolean`,
   };
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
   * Check each option's property type.
   */
  #checkTypes() {
    const pairs = this._getCheckTypePairs();

    typedKeys(pairs).forEach(key => {
      const t = pairs[key];
      const v = this.options[key];
      REQUIRE(!v || typeof t === 'function' && t(v) || typeof v === t, 
        `The type of option ${key} is incorrect.`, InvalidOptions, { name: key });
      });
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
    this.#checkTypes();
    // 併用チェック
    this.#checkCompeting();
  }

  /**
   * Transform, and complete options.
   * @param defaultOpts  Defalt options
   */
  #normalizeOptions(defaultOpts?: T): void {
    this.#convSecToMs();

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
   * Convert a value in seconds to milliseconds.
   */
  #convSecToMs() {
    const keys = this._getTimeKeys();
    // Treat this.options as a type containing only the time key (type assertion)
    // Here, use 'as unknown as ...' to safely cast via unknown
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
