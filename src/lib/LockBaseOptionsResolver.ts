import { Contracts } from '@ayapapa-npm/contracts-js';
import { type LockBaseOptions, type LockBaseRequiredNumericOptions, type LockBaseRequiredOptions } from './LockBaseOptions.ts';
import { InvalidOptions } from './LockBaseErrors.ts';
import { includesAllKeysOf, typedKeys, type KeyTypeMap, type TimeBasedKey } from './Util.ts'

const {REQUIRE, REQUIRE_DEBUG, VERIFY_DEBUG} = Contracts;

/**
 * @internal
 * Types of seconds-time-based key.
 */
type SecKey<T> = `${TimeBasedKey<T>}Sec`;

/**
 * @internal
 * Types of millisecond-time-based key.
 */
type MsKey<T> = `${TimeBasedKey<T>}Ms`;

/**
 * @internal
 * A class that resolves options.
 * Base class: Accepts a generic type O
 */
export class LockBaseOptionsResolver <
  O extends LockBaseOptions = LockBaseOptions,
  M extends LockBaseRequiredNumericOptions = LockBaseRequiredNumericOptions,
  R extends LockBaseRequiredOptions = LockBaseRequiredOptions,
  > {

  /** Instance fields. */

  /** Options. */
  protected options: O;

  /** Default options. */
  protected defaultOptions?: R | null;

  /** Minimum option values. */
  protected minimumOptions: M;

  /** Instance methods. */

  /**
   * Constructor
   * @param userOpts        User options.
   * @param minimumOptions  Minimum option values.
   * @param defaultOptions  Default options.
   */
  constructor(userOpts: O, minimumOptions: M, defaultOptions?: R) {
    // Delete _resolvedOpts for tests, if exists.
    if ('_resolvedOpts' in userOpts) delete userOpts._resolvedOpts;

    this.options = { ...userOpts };
    this.minimumOptions = { ...minimumOptions };
    this.defaultOptions = defaultOptions ? { ...defaultOptions } : null;

    this.#resolveOptions();

    // Add _resolvedOpts for tests.
    Object.assign(userOpts, { _resolvedOpts: this.options });
  }

  /** Get options. */
  public getOptions(): O {
    return this.options;
  }

  /** 
   * Get an option consisting of required properties. Error if any properties are missing. 
   */
  public getRequiredOptions(): R {
    REQUIRE(this.defaultOptions != null, 
      "To generate required options, specify `defaultOptions` in the constructor.", 
      InvalidOptions, { name: 'this.defaultOptions' });
    
    const missings: string[] = [];
    // It has been verified that this.defaultOptions is non-null.
    // Verify whether `this.options` contains the required keys.
    if (includesAllKeysOf(this.options, this.defaultOptions!, missings)) {
      // Ok, so type-cast and return it.
      return this.options as unknown as R;
    }
    else { // Error
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

  /**
   * Apply the minimum value.
   */
  #applyMinimum() {
    // Since property type inference does not work as expected, cast the object to Record<string, number>
    // and validate to ensure type safety.
    const min = this.minimumOptions as Record<string, number>;
    const opt = this.options as unknown as Record<string, number>;

    // To be certain, verify that all properties in the minor procedure set are numerical.
    // Since this function is not accessed directly from the outside, `_DEBUG` is used.
    REQUIRE_DEBUG(
      Object.values(min).every(value => typeof value === 'number'),
      'The minimum options set (minimumOptions) contains properties that are not numbers.',
      InvalidOptions,
      { name: 'this->minimumOptions', props: { minimumOptions: min } }
    );

    const keys = Object.keys(this.minimumOptions);
    keys.forEach(key => {
      if (key in this.options) {

        // To be certain, verify that typeof options[key] is numerical.
        // Since this function is not accessed directly from the outside, `_DEBUG` is used.
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

  /**
   * Apply the default values.
   */
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
    this.#checkTypes();
    this.#checkCompeting();
  }

  /** 
   * @internal
   * get TimeBaseKey-> SecBaseKey map.
   */
  #getSecKeyMap(keys: TimeBasedKey<O>[]): Record<string, keyof O> {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Sec` as keyof O])
    );
  }

  /**
   * @internal
   * get TimeBaseKey-> MsBaseKey map.
   */
  #getMsKeyMap(keys: TimeBasedKey<O>[]): Record<string, keyof O> {
    return Object.fromEntries(
      keys.map(key => [key, `${key}Ms` as keyof O])
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
